# 🍱 Firebase 統合 - 実装ガイド

**3ステップで完成 + デプロイ可能**

---

## 📝 実装概要

| 項目 | 現在（SQLite+Node） | Firebase版 | 効果 |
|-----|--------|---------|------|
| ネットワーク | Wi-Fi/LAN必須 | モバイルデータ対応 | 全国どこからでもアクセス可能 |
| 複数拠点 | 不可 | ✅ 自動対応 | 複数店舗でもDB共有 |
| デプロイ | 自分でサーバー管理 | Firebase Hosting | 管理不要 |
| 無料枠 | なし | ✅ 1GB + リクエスト無制限 | 小規模ならずっと無料 |
| TTL/削除 | 手動 | Cloud Functions で自動 | 30日以上前のデータ自動削除 |
| スケール | 限定的 | 自動スケール | アクセス増加に自動対応 |

---

## 🚀 実装ステップ（所要時間：30分）

### **ステップ 1: Firebase プロジェクト作成**

[Firebase Console](https://console.firebase.google.com/)：

```
1. 「プロジェクトを作成」
2. プロジェクト名：bento-order-system
3. ロケーション：asia-northeast1（日本）
4. Realtime Database 作成（テストモード）
5. Web アプリ登録 → firebaseConfig をコピー
```

### **ステップ 2: firebaseConfig を設定**

`firebase-integration.js` を編集：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxx",  // ← コピペ
  authDomain: "bento-order-system.firebaseapp.com",
  databaseURL: "https://bento-order-system.firebaseio.com",
  projectId: "bento-order-system",
  storageBucket: "bento-order-system.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefgh"
};
```

### **ステップ 3: index.html に Firebase SDK を追加**

`index.html` の `<head>` に追加：

```html
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js"></script>
<script src="firebase-integration.js"></script>
```

完了！

---

## 🧪 ローカルテスト

### **テスト 1: 同じWi-Fi で複数端末**

**PC 側**：
```bash
npm start
http://localhost:3000
```

**スマホ側**：
```
http://<PC-IP>:3000
```

**テスト**：
- PC で「10001」追加
- スマホで自動更新 ✓

### **テスト 2: Firebase リアルタイム同期確認**

1. ブラウザ2つ開く
2. 一方で入力
3. もう一方が自動更新 ✓

---

## 🔒 セキュリティルール設定

Firebase Console → Realtime Database → ルール タブ：

```json
{
  "rules": {
    "orders": {
      ".read": true,
      ".write": true
    },
    "pickup_log": {
      ".read": true,
      ".write": true
    },
    "daily_log": {
      ".read": true,
      ".write": true
    }
  }
}
```

⚠️ **本番運用前に認証追加推奨**（後述）

---

## ⏰ TTL/自動削除設定

### **設定方法**

Firebase Console → Functions タブ：

```javascript
// deployする関数
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// 毎日午前4時に実行
exports.cleanupOldOrders = functions.pubsub
  .schedule("0 4 * * *")
  .timeZone("Asia/Tokyo")
  .onRun(async (context) => {
    const db = admin.database();
    const ordersRef = db.ref("orders");
    
    const snapshot = await ordersRef.once("value");
    const orders = snapshot.val();
    
    if (!orders) {
      console.log("削除対象なし");
      return null;
    }
    
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30日前
    
    let deletedCount = 0;
    for (const [key, order] of Object.entries(orders)) {
      const createdAt = order.createdAt 
        ? new Date(order.createdAt).getTime() 
        : 0;
      
      // 30日以上前で、かつ受け取り済みなら削除
      if (createdAt < thirtyDaysAgo && order.served) {
        await ordersRef.child(key).remove();
        deletedCount++;
      }
    }
    
    console.log(`削除完了: ${deletedCount} 件`);
    return null;
  });
```

**デプロイ方法**：
```bash
firebase deploy --only functions
```

---

## 🌍 デプロイメント（Firebase Hosting）

### **ステップ 1: Firebase CLI セットアップ**

```bash
npm install -g firebase-tools
firebase login
```

### **ステップ 2: プロジェクト初期化**

```bash
cd /home/eng-std/s0623020/smartreader
firebase init hosting
```

対話形式で：
- **Project：** bento-order-system
- **Public directory：** `.`
- **Single-page app：** No
- **GitHub Deploy：** No

### **ステップ 3: デプロイ**

```bash
firebase deploy --only hosting
```

**完了時の出力**：
```
Hosting URL: https://bento-order-system.web.app
```

---

## 📱 デプロイ後のアクセス

**PC・スマホ・タブレット、すべてのデバイスで**：

```
https://bento-order-system.web.app
```

✅ モバイルデータ通信でもOK  
✅ Wi-Fi 不要  
✅ インターネット接続さえあれば全国対応

---

## 📊 ストレージ容量管理

### **無料プランの容量**

| 項目 | 制限 | 備考 |
|-----|-----|------|
| Realtime DB | 1GB | 十分 |
| Hosting | 1GB | HTML/JS は数MB |
| 月間ダウンロード | 10GB | 超過時は追加料金 |

### **30日ごとの削除で無期限運用可能**

```
日数 → 1日平均 10件 × 30日 = 300件
サイズ → 300件 × 0.5KB = 150KB

→ 1GB に達するには：
  150KB × 6,666 ヶ月 = 555年分

つまり永遠に無料 ✓
```

---

## 🔄 既存 POS との連携

### **移行パターン**

```
現在: Firebase + ローカル ORDERS 配列
        ↓
将来: Firebase → 定期的に既存DB にエクスポート
        ↓
完全統合: 既存DB ← API ← Firebase
```

**移行時のコード変更は最小限**：
```javascript
// 現在の API 層（そのまま利用可能）
POST /api/orders ← Firebase に変更
```

---

## 🚨 トラブルシューティング

### **Q: Firebase に接続できない**

```
→ firebaseConfig を確認
→ インターネット接続確認
→ ブラウザコンソール（F12）でエラー確認
```

### **Q: データが同期されない**

```
→ ブラウザを再読み込み（Ctrl+Shift+R）
→ ブラウザのキャッシュクリア
→ Firebase Console でデータ確認
```

### **Q: セキュリティルールエラー**

```
→ Firebase Console → Realtime Database → ルール
→ 上の JSON を正確に貼り付け
→ 「公開」ボタンで適用
```

### **Q: デプロイが失敗する**

```bash
# デバッグモード
firebase deploy --only hosting --debug

# 古いバージョンの場合
npm install -g firebase-tools@latest
```

---

## 🎯 本番運用チェックリスト

- [ ] firebaseConfig が正確に設定されている
- [ ] Firebase Realtime Database が有効
- [ ] セキュリティルール設定済み
- [ ] Cloud Functions で TTL 設定済み
- [ ] Firebase Hosting にデプロイ済み
- [ ] テスト用デバイスで複数同期確認
- [ ] ログイン機能（オプション）設定
- [ ] バックアップ戦略決定

---

## 🔐 本番前：セキュリティ強化（オプション）

### **認証の追加（Firebase Authentication）**

```javascript
// ユーザー認証を必須化
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    // ログイン画面へリダイレクト
    window.location.href = "/login.html";
  }
});
```

### **ロール分離**

```json
{
  "rules": {
    "orders": {
      ".read": "root.child('users').child(auth.uid).child('role').val() === 'staff'",
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'staff'"
    }
  }
}
```

---

## 📞 Firebase サポート

### **公式ドキュメント**

- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Cloud Functions](https://firebase.google.com/docs/functions)

### **料金計算**

[Firebase 料金計算ツール](https://cloud.google.com/products/calculator)

---

## 🎉 これで完成！

**達成したこと**：
- ✅ Wi-Fi 不要（モバイルデータ対応）
- ✅ 複数拠点対応（複数店舗でDB共有）
- ✅ 自動デプロイ（管理不要）
- ✅ TTL 自動削除（永遠に無料）
- ✅ 拡張性高い（通知機能等）

---

**会社への提案時に強調するポイント**：
```
「スタッフはスマホのモバイルデータで営業所から、
 顧客も全国どこからでもアクセス可能。
 管理サーバー不要でずっと無料で運用できます。」
```

🚀 **デプロイして、実際に複数デバイスで試してみてください！**
