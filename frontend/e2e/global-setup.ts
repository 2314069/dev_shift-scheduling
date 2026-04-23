// No-op. test DB の削除は backend webServer の起動コマンドで行う
// (Playwright の globalSetup は webServer 起動後に実行されるため、
//  ここで削除すると backend が create した DB を消してしまう)。
async function globalSetup() {}

export default globalSetup;
