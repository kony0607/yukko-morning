<!-- 
Firebase 対応版 index.html の実装パターン
このファイルを既存の index.html と置き換える
-->

<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js"></script>

<script>
// ===== Firebase 設定 =====
// FIREBASE_CONFIG をここに貼り付ける（ステップ3 で取得）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let firebase_initialized = false;
let database = null;
let ordersRef = null;
let pickupLogRef = null;
let dailyLogRef = null;

// Firebase 初期化
function initializeFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    ordersRef = database.ref("orders");
    pickupLogRef = database.ref("pickup_log");
    dailyLogRef = database.ref("daily_log");
    firebase_initialized = true;
    console.log("✓ Firebase 初期化完了");
    
    // リアルタイムリスナー設定
    listenToOrders();
    listenToPickupLog();
    
    return true;
  } catch(error) {
    console.warn("Firebase 初期化失敗。ローカルモードで続行:", error);
    firebase_initialized = false;
    return false;
  }
}

// リアルタイムリスナー：orders
function listenToOrders() {
  if (!ordersRef) return;
  
  ordersRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      ORDERS.length = 0;
      Object.keys(data).forEach(key => {
        const order = data[key];
        ORDERS.push({
          id: key, // Firebase キーを保存
          ...order
        });
      });
      console.log(`✓ Firebase から ${ORDERS.length} 件のオーダーを読み込み`);
      renderAll();
    }
  }, (error) => {
    console.error("Firebase リスナーエラー:", error);
  });
}

// リアルタイムリスナー：pickup_log
function listenToPickupLog() {
  if (!pickupLogRef) return;
  
  pickupLogRef.limitToLast(50).on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      PICKUP_LOG.length = 0;
      Object.keys(data).reverse().forEach(key => {
        PICKUP_LOG.push({
          id: key,
          ...data[key]
        });
      });
      renderPickupLog();
    }
  });
}

// ===== Firebase に保存 =====

async function addOrderToFirebase(order) {
  if (!firebase_initialized) {
    console.log("Firebase オフライン。ローカルに保存");
    return null;
  }
  
  try {
    order.createdAt = new Date().toISOString();
    order.served = order.served ? 1 : 0;
    
    const newRef = await ordersRef.push(order);
    console.log(`✓ Firebase に保存: ${order.lockerFull}`);
    return newRef.key;
  } catch(error) {
    console.error("保存エラー:", error);
    return null;
  }
}

async function updateOrderInFirebase(id, updates) {
  if (!firebase_initialized) {
    console.log("Firebase オフライン。ローカルに更新");
    return;
  }
  
  try {
    await ordersRef.child(id).update(updates);
    console.log(`✓ Firebase 更新: ${id}`);
  } catch(error) {
    console.error("更新エラー:", error);
  }
}

async function deleteOrderFromFirebase(id) {
  if (!firebase_initialized) {
    console.log("Firebase オフライン。ローカルから削除");
    return;
  }
  
  try {
    await ordersRef.child(id).remove();
    console.log(`✓ Firebase から削除: ${id}`);
  } catch(error) {
    console.error("削除エラー:", error);
  }
}

async function addPickupLogToFirebase(log) {
  if (!firebase_initialized) return;
  
  try {
    log.timestamp = new Date().toISOString();
    await pickupLogRef.push(log);
    console.log(`✓ ピックアップ記録を保存`);
  } catch(error) {
    console.error("ログ保存エラー:", error);
  }
}

// ===== 既存関数の Firebase 対応版 =====

async function addManualOrder(){
  const lockerFull = fullCodeFromInput(document.getElementById('manualLocker').value);
  if(lockerFull.length < 5){
    alert('5桁のロッカー番号を入力してください。');
    return;
  }
  
  const bento = document.getElementById('manualBento').value;
  const quantity = Math.max(1, Number(document.getElementById('manualQty').value || 1));
  const rice = Math.max(0, Number(document.getElementById('manualRice').value || 0));
  
  const order = {
    lockerFull,
    callCode: callCodeFromFull(lockerFull),
    bento,
    rice,
    quantity,
    orderTime: document.getElementById('manualTime').value || '',
    allergy: document.getElementById('manualAllergy').value.trim(),
    served: false,
    source: 'manual',
    coffee: bento === 'yo2' ? false : null,
  };
  
  // Firebase に保存
  const firebaseId = await addOrderToFirebase(order);
  
  // Firebase が利用不可の場合、ローカルに追加
  if (!firebaseId && firebase_initialized === false) {
    order.id = `local-${Date.now()}`;
    ORDERS.push(order);
  }
  
  // フォーム クリア
  document.getElementById('manualLocker').value = '';
  document.getElementById('manualCall').value = '';
  document.getElementById('manualQty').value = 1;
  document.getElementById('manualAllergy').value = '';
  document.getElementById('manualTime').value = '';
  syncRiceByBento();
  renderAll();
}

async function deleteOrder(index){
  const order = ORDERS[index];
  if(!order) return;
  
  // Firebase から削除
  if (order.id && firebase_initialized) {
    await deleteOrderFromFirebase(order.id);
  }
  
  // ローカルから削除
  ORDERS.splice(index, 1);
  renderAll();
}

async function pickupOrderByCode(code){
  if(!activeDay){
    document.getElementById('pickupResult').innerHTML = '<div class="notice">先にスタッフ入力で「受け取り受付を開始」を押してください。</div>';
    return;
  }
  
  const order = ORDERS.find(item => !item.served && (item.lockerFull === code || item.callCode === code));
  if(!order){
    const already = ORDERS.find(item => item.lockerFull === code || item.callCode === code);
    document.getElementById('pickupResult').innerHTML = already ? '<div class="notice notice-warn">すでに受取済みです。</div>' : '';
    if(!already) showNotFound(code);
    return;
  }
  
  // Firebase に更新
  const pickupTime = new Date().toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'});
  
  if (order.id && firebase_initialized) {
    await updateOrderInFirebase(order.id, { served: 1 });
    await addPickupLogToFirebase({
      code: order.callCode || callCodeFromFull(order.lockerFull),
      locker: order.lockerFull,
      bento: getBentoLabel(order.bento),
      time: pickupTime
    });
  }
  
  // ローカルも更新
  order.served = true;
  currentOrder = order;
  currentLocker = code;
  showOrder(order);
  
  PICKUP_LOG.unshift({
    code: order.callCode || callCodeFromFull(order.lockerFull),
    locker: order.lockerFull,
    bento: getBentoLabel(order.bento),
    time: pickupTime
  });
  
  renderPickupLog();
  renderAll();
}

// 初期化時に Firebase を呼び出し
async function loadFromServer(){
  // Firebase を試す
  if (initializeFirebase()) {
    console.log("✓ Firebase モードで起動");
    return;
  }
  
  // Firebase 失敗時はローカルのみ
  console.log("✓ ローカルモードで起動");
}

</script>
