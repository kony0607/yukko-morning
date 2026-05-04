const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// ミドルウェア
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// SQLiteデータベース初期化
const DB_PATH = path.join(__dirname, 'orders.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('データベース接続エラー:', err);
  } else {
    console.log('✓ SQLite接続: ' + DB_PATH);
    initializeDatabase();
  }
});

// データベーススキーマ初期化
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lockerFull TEXT UNIQUE NOT NULL,
      callCode TEXT NOT NULL,
      bento TEXT NOT NULL,
      rice INTEGER NOT NULL,
      price INTEGER DEFAULT 0,
      quantity INTEGER NOT NULL,
      orderTime TEXT,
      allergy TEXT,
      served INTEGER DEFAULT 0,
      source TEXT,
      coffee INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('テーブル作成エラー:', err);
    else console.log('✓ テーブル初期化完了');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS pickup_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      locker TEXT NOT NULL,
      bento TEXT NOT NULL,
      time TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('ピックアップログテーブル作成エラー:', err);
    else console.log('✓ ピックアップログテーブル初期化完了');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      summary TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('日報テーブル作成エラー:', err);
    else console.log('✓ 日報テーブル初期化完了');
  });
}

// 既存DBに price カラムがなければ追加（安全対策）
function ensurePriceColumn(){
  db.all("PRAGMA table_info(orders)", (err, rows) => {
    if(err) return console.warn('PRAGMA error:', err);
    const hasPrice = rows && rows.some(r => r.name === 'price');
    if(!hasPrice){
      db.run('ALTER TABLE orders ADD COLUMN price INTEGER DEFAULT 0', (err2) => {
        if(err2) console.warn('price column add error:', err2);
        else console.log('✓ orders.price カラムを追加しました');
      });
    }
  });
}

// ensurePriceColumn は DB 初期化後に実行
setTimeout(ensurePriceColumn, 500);

// ========== API エンドポイント ==========

/**
 * GET /api/orders
 * 全注文取得
 */
app.get('/api/orders', (req, res) => {
  db.all(
    'SELECT * FROM orders ORDER BY createdAt ASC',
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows || []);
      }
    }
  );
});

/**
 * GET /api/orders/:lockerFull
 * 特定のロッカー番号で検索
 */
app.get('/api/orders/:lockerFull', (req, res) => {
  const { lockerFull } = req.params;
  db.get(
    'SELECT * FROM orders WHERE lockerFull = ?',
    [lockerFull],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (!row) {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.json(row);
      }
    }
  );
});

/**
 * POST /api/orders
 * 新規注文追加
 */
app.post('/api/orders', (req, res) => {
  const {
    lockerFull,
    callCode,
    bento,
    rice,
    quantity,
    source,
    coffee
  } = req.body;

  db.run(
    `INSERT INTO orders 
    (lockerFull, callCode, bento, rice, quantity, served, source, coffee) 
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [lockerFull, callCode, bento, rice, quantity, source || 'manual', coffee || 0],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'このロッカー番号は既に登録されています' });
        } else {
          res.status(500).json({ error: err.message });
        }
      } else {
        res.status(201).json({
          id: this.lastID,
          lockerFull,
          callCode,
          bento,
          rice,
          quantity,
          source,
          coffee,
          served: 0
        });
      }
    }
  );
});

/**
 * PUT /api/orders/:lockerFull
 * 注文更新（提供済みフラグなど）
 */
app.put('/api/orders/:lockerFull', (req, res) => {
  const { lockerFull } = req.params;
  const updates = req.body;

  // UPDATE文を動的に構築
  const allowedFields = ['served', 'coffee'];
  const updateFields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updateFields.length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  values.push(lockerFull);
  updateFields.push('updatedAt = CURRENT_TIMESTAMP');

  db.run(
    `UPDATE orders SET ${updateFields.join(', ')} WHERE lockerFull = ?`,
    values,
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Order not found' });
      } else {
        // 更新結果を返す
        db.get(
          'SELECT * FROM orders WHERE lockerFull = ?',
          [lockerFull],
          (err, row) => {
            if (err) {
              res.status(500).json({ error: err.message });
            } else {
              res.json(row);
            }
          }
        );
      }
    }
  );
});

/**
 * DELETE /api/orders/:lockerFull
 * 注文削除
 */
app.delete('/api/orders/:lockerFull', (req, res) => {
  const { lockerFull } = req.params;
  db.run(
    'DELETE FROM orders WHERE lockerFull = ?',
    [lockerFull],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Order not found' });
      } else {
        res.json({ message: 'Deleted successfully', changes: this.changes });
      }
    }
  );
});

/**
 * POST /api/pickup-log
 * ピックアップ記録
 */
app.post('/api/pickup-log', (req, res) => {
  const { code, locker, bento, time } = req.body;
  db.run(
    'INSERT INTO pickup_log (code, locker, bento, time) VALUES (?, ?, ?, ?)',
    [code, locker, bento, time],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.status(201).json({
          id: this.lastID,
          code,
          locker,
          bento,
          time
        });
      }
    }
  );
});

/**
 * GET /api/pickup-log
 * ピックアップログ取得
 */
app.get('/api/pickup-log', (req, res) => {
  db.all(
    'SELECT * FROM pickup_log ORDER BY createdAt DESC LIMIT 100',
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows || []);
      }
    }
  );
});

/**
 * DELETE /api/pickup-log/:id
 * ピックアップログ削除
 */
app.delete('/api/pickup-log/:id', (req, res) => {
  const { id } = req.params;
  db.run(
    'DELETE FROM pickup_log WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Deleted successfully' });
      }
    }
  );
});

/**
 * POST /api/daily-log
 * 日報記録
 */
app.post('/api/daily-log', (req, res) => {
  const { date, summary } = req.body;
  db.run(
    'INSERT OR REPLACE INTO daily_log (date, summary) VALUES (?, ?)',
    [date, JSON.stringify(summary)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: 'Logged successfully' });
      }
    }
  );
});

/**
 * GET /api/daily-log
 * 日報取得
 */
app.get('/api/daily-log', (req, res) => {
  db.all(
    'SELECT * FROM daily_log ORDER BY date DESC',
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json((rows || []).map(row => ({
          ...row,
          summary: JSON.parse(row.summary || '{}')
        })));
      }
    }
  );
});

/**
 * GET /health
 * ヘルスチェック
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🍱 お弁当統合システム                 ║
║   バックエンドサーバー起動完了          ║
╠════════════════════════════════════════╣
║ 🌐 http://localhost:${PORT}                ║
║ 📊 Database: ${DB_PATH}
║ 📡 API Ready ✓                         ║
╚════════════════════════════════════════╝
  `);
  console.log('利用可能なエンドポイント:');
  console.log('  GET    /api/orders              - 全注文取得');
  console.log('  GET    /api/orders/:lockerFull  - 特定注文取得');
  console.log('  POST   /api/orders              - 注文追加');
  console.log('  PUT    /api/orders/:lockerFull  - 注文更新');
  console.log('  DELETE /api/orders/:lockerFull  - 注文削除');
  console.log('  POST   /api/pickup-log          - ピックアップ記録');
  console.log('  GET    /api/pickup-log          - ピックアップ履歴');
  console.log('  GET    /api/daily-log           - 日報取得');
  console.log('');
  console.log('Ctrl+C で終了');
});

// graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nシャットダウン中...');
  db.close((err) => {
    if (err) console.error(err);
    console.log('✓ データベース接続を閉じました');
    process.exit(0);
  });
});
