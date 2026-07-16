const fs = require('fs');
let content = fs.readFileSync('src/pages/StoreDisplay.jsx', 'utf8');

content = content.replace(/import \{ Alert, AlertDescription, AlertTitle \} from '@\/components\/ui\/alert';\n/, '');

content = content.replace(
  /<Alert variant="destructive"[\s\S]*?<\/Alert>/,
  `<div className="max-w-2xl bg-red-950/50 border border-red-900 rounded-lg p-6 flex items-start gap-4 text-red-500">
          <AlertCircle className="h-8 w-8 shrink-0" />
          <div>
            <h2 className="text-2xl font-semibold mb-2">에러 발생</h2>
            <div className="text-lg opacity-90">
              {error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.'}
              <br />
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-3 bg-red-900/50 hover:bg-red-800/50 rounded-lg transition-colors"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>`
);

fs.writeFileSync('src/pages/StoreDisplay.jsx', content, 'utf8');
console.log('Fixed StoreDisplay.jsx');
