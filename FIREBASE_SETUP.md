# 🍱 Firebase 版 - セットアップガイド

**クラウド・モバイルデータ通信対応版**

---

## 📋 Firebase の準備（5分）

### **ステップ 1: Firebase プロジェクト作成**

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. **「プロジェクトを作成」** クリック
3. プロジェクト名：`bento-order-system`
4. **「続行」** → **「プロジェクトを作成」**
5. 2-3 分で準備完了

### **ステップ 2: Realtime Database 有効化**

1. 左メニュー → **「Build」** → **「Realtime Database」**
2. **「データベースを作成」**
3. ロケーション：`asia-northeast1`（日本）選択
4. セキュリティルール：**「テストモード」** 選択（後で修正）
5. **「作成」**

### **ステップ 3: SDK 認証情報を取得**

1. 左メニュー → **「設定」** → **「プロジェクト設定」**
2. **「webApps」** アイコン
3. **「新しいウェブアプリを登録」**
4. アプリ名：`bento-order`
5. 表示された設定をコピー（下の `firebaseConfig` に貼り付け）

```javascript
// これをコピーしておく
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "bento-order-system.firebaseapp.com",
  databaseURL: "https://bento-order-system.firebaseio.com",
  projectId: "bento-order-system",
  storageBucket: "bento-order-system.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefgh"
};
```

---

## 🔒 セキュリティルール設定（重要）

Firebase Console で：

1. **Realtime Database** → **「ルール」** タブ
2. 以下を貼り付け：

```json
{
  "rules": {
    "orders": {
      ".read": true,
      ".write": true,
      "$lockerFull": {
        ".validate": "newData.hasChildren(['lockerFull', 'bento', 'rice', 'quantity'])"
      }
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

3. **「公開」** ボタン

---

## ⏰ TTL（自動削除）設定

Firebase では TTL が直接設定できないため、**Cloud Functions** で実装：

### **Cloud Functions 有効化**

1. 左メニュー → **「Build」** → **「Functions」**
2. **「関数を作成」**
3. 関数名：`cleanupOldOrders`
4. トリガー：**「Cloud Pub/Sub」** → **「トピックを作成」**

### **コード：**

```javascript
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.cleanupOldOrders = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    const db = admin.database();
    const ordersRef = db.ref("orders");
    
    const snapshot = await ordersRef.once("value");
    const orders = snapshot.val();
    
    if (!orders) return;
    
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30日前
    
    for (const [key, order] of Object.entries(orders)) {
      const orderTime = new Date(order.createdAt).getTime();
      if (orderTime < thirtyDaysAgo && order.served) {
        await ordersRef.child(key).remove();
        console.log(`削除: ${key}`);
      }
    }
    
    return null;
  });
```

---

## 💻 ブラウザ実装

### **HTML に Firebase SDK を追加**

```html
<!-- index.html の <head> に追加 -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js"></script>
```

### **JavaScript で Firebase 初期化**

```javascript
// firebaseConfig をコピーしたものを使用
const firebaseConfig = {
  // 上のステップ3でコピーしたやつ
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// データ読み込み
const ordersRef = database.ref("orders");
ordersRef.on("value", (snapshot) => {
  const data = snapshot.val();
  if (data) {
    ORDERS.length = 0;
    ORDERS.push(...Object.values(data));
    renderAll();
  }
});

// データ追加
async function addOrder(order) {
  const newRef = database.ref("orders").push();
  order.createdAt = new Date().toISOString();
  await newRef.set(order);
}

// データ更新
async function updateOrder(lockerFull, updates) {
  await database.ref(`orders/${lockerFull}`).update(updates);
}
```

---

## 📱 複数デバイス同期テスト

### **テスト方法**

**PC 側**：
```
https://<デプロイURL>/index.html
```

**スマホ側**：
```
モバイルデータ回線で同じ URL にアクセス
```

**期待される動作**：
- PC で「10001」追加
- スマホが自動更新 ✓
- どちらからでも確認可能 ✓

---

## 🚀 デプロイメント（Firebase Hosting）

### **ステップ 1: Firebase CLI インストール**

```bash
npm install -g firebase-tools
firebase login
```

### **ステップ 2: プロジェクト初期化**

```bash
cd /home/eng-std/s0623020/smartreader
firebase init hosting
```

選択：
- **Project：** `bento-order-system`
- **Public directory：** `.`（現在ディレクトリ）
- **Single-page app：** `No`
- **GitHub Deploy：** `No`

### **ステップ 3: デプロイ**

```bash
firebase deploy --only hosting
```

**出力例**：
```
🎉  Deploy complete!

Project Console: https://console.firebase.google.com/project/bento-order-system/overview
Hosting URL: https://bento-order-system.web.app
```

---

## 📊 Firebase コンソールでデータ確認

1. Firebase Console
2. **Realtime Database**
3. **「データ」** タブ
4. JSON 形式でリアルタイム表示

```json
{
  "orders": {
    "-Nxyz1234567": {
      "lockerFull": "10001",
      "bento": "wa",
      "served": false,
      "createdAt": "2026-05-04T..."
    }
  },
  "pickup_log": { ... },
  "daily_log": { ... }
}
```

---

## ⚠️ 無料プランの制限

| 項目 | 制限 | 対策 |
|-----|-----|------|
| 同時接続 | 100 | 問題なし（小規模運用） |
| ストレージ | 1GB | 30日ごと削除で対応 |
| 読み書き | 無制限 | ✓ |
| ネットワーク | 10GB/月 | 十分 |

**テストなら無料プランで十分。本運用でも月数百円程度です。**

---

## 🔄 既存 DB への移行路

```
Firebase Realtime DB（現在）
        ↓
同期 Cloud Function
        ↓
既存システム DB へ毎日エクスポート
        ↓
完全統合（必要に応じて）
```

---

## 📱 将来拡張：プッシュ通知

Firebase Cloud Messaging (FCM) で実装可能：

```javascript
// 「明日の個数は30個です」通知
const message = {
  notification: {
    title: "明日のお弁当",
    body: "明日の個数は30個です。準備ください。"
  },
  data: {
    count: "30"
  }
};

// Firebase Admin SDK で配信
admin.messaging().send(message);
```

---

## 🎯 まとめ

**Firebase 版のメリット**：
1. ✅ インターネット接続があれば全国対応
2. ✅ Wi-Fi 不要（モバイルデータでOK）
3. ✅ デプロイ簡単（ホスティング付き）
4. ✅ TTL 設定可能（古いデータ自動削除）
5. ✅ 拡張性高い（通知、機械学習等）
6. ✅ 無料プラン充実
7. ✅ 既存 DB 連携の道あり

---

**次のステップ：Firebase 版の index.html を作成 →テスト → デプロイ**
