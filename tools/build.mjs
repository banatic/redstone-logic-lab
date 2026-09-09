/*
  dev.html(ES 모듈 버전) 을 파일 하나로 합쳐 index.html 을 만든다:
      node tools/build.mjs

  index.html 은 더블클릭만으로 열리고 GitHub Pages 에도 그대로 올라간다.
  index.html 을 직접 고치지 말고 js/ · css/ · dev.html 을 고친 뒤 다시 빌드할 것.

  ES 모듈은 file:// 에서 CORS 로 차단되므로, 모든 모듈을 하나의 일반 <script> 안에
  작은 모듈 레지스트리(__M) 형태로 감싸 넣는다.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* 괄호 깊이를 지키며 콤마로 나눈다 */
function splitTop(src) {
  const out = []; let d = 0, cur = '';
  for (const ch of src) {
    if ('([{'.includes(ch)) d++;
    else if (')]}'.includes(ch)) d--;
    if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/* 한 모듈의 export 이름들을 찾아낸다 */
function exportNames(src) {
  const names = [];
  const re = /^export\s+(class|function|const|let|var)\s+([^\n]*)$/gm;
  let m;
  while ((m = re.exec(src))) {
    const [, kind, rest] = m;
    if (kind === 'class' || kind === 'function') {
      names.push(rest.match(/^([A-Za-z_$][\w$]*)/)[1]);
    } else {
      const semi = rest.indexOf(';');
      const body = semi >= 0 ? rest.slice(0, semi) : rest;
      for (const part of splitTop(body)) {
        const id = part.trim().match(/^([A-Za-z_$][\w$]*)/);
        if (id) names.push(id[1]);
        if (semi < 0) break;      // 여러 줄 선언이면 첫 이름만
      }
    }
  }
  return [...new Set(names)];
}

/* import 문을 레지스트리 참조로, export 키워드는 제거 */
function rewrite(src) {
  return src
    .replace(/import\s*\*\s*as\s+THREE\s+from\s*['"][^'"]+['"];?/g, 'const THREE = __THREE;')
    .replace(/import\s*(\{[\s\S]*?\})\s*from\s*['"]\.\/([\w-]+)\.js['"];?/g,
      (_, spec, mod) => `const ${spec} = __M[${JSON.stringify(mod)}];`)
    .replace(/^export\s+/gm, '');
}

function wrapModule(name, file) {
  const src = read(file);
  const names = exportNames(src);
  return `__M[${JSON.stringify(name)}] = (function () {\n'use strict';\n`
    + rewrite(src)
    + `\nreturn { ${names.join(', ')} };\n})();\n`;
}

// ---- three.js: 맨 끝의 export {...} 를 return {...} 으로 바꿔 IIFE 로 감싼다
const three = read('vendor/three.module.js');
const idx = three.lastIndexOf('\nexport {');
if (idx < 0) throw new Error('three.module.js 의 export 블록을 찾지 못했습니다');
const threeIife =
  'const __THREE = (function () {\n\'use strict\';\n'
  + three.slice(0, idx) + '\nreturn {' + three.slice(idx + '\nexport {'.length)
  + '\n})();\n';

// ---- 내 모듈들 (의존 순서대로)
const MODULES = [
  ['blocks', 'js/blocks.js'],
  ['shapes', 'js/shapes.js'],
  ['world', 'js/world.js'],
  ['redstone', 'js/redstone.js'],
  ['render', 'js/render.js'],
  ['particles', 'js/particles.js'],
  ['player', 'js/player.js'],
  ['examples', 'js/examples.js'],
  ['missions', 'js/missions.js'],
  ['museum', 'js/museum.js'],
];
let bundle = '(function () {\n\'use strict\';\nconst __M = {};\n' + threeIife;
for (const [name, file] of MODULES) bundle += wrapModule(name, file);
bundle += '\n// ---- main ----\n(function () {\n\'use strict\';\n'
  + rewrite(read('js/main.js')) + '\n})();\n})();\n';

// ---- HTML 조립
const css = read('css/style.css');
// 주의: 치환 문자열 안의 $' $& 등이 특수 문자로 해석되므로 반드시 함수로 넘긴다
let html = read('dev.html')
  .replace(/<link rel="stylesheet" href="css\/style\.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module"[^>]*><\/script>/, () => `<script>\n${bundle}\n</script>`)
  // file:// 안내 블록은 단일 파일 버전에 필요 없으므로 제거
  .replace(/<div id="filewarn"[\s\S]*?<\/script>\s*/, () => '');

const BANNER = '<!-- 자동 생성 파일입니다. tools/build.mjs 로 dev.html 에서 만들어집니다. -->';
html = BANNER + '\n' + html;
writeFileSync(join(ROOT, 'index.html'), html);
console.log('index.html 생성 완료 —', (html.length / 1024 / 1024).toFixed(2), 'MB');
