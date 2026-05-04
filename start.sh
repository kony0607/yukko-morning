#!/bin/bash
# 🍱 お弁当統合システム - クイック起動スクリプト

echo "╔════════════════════════════════════════╗"
echo "║   🍱 お弁当統合システム                 ║"
echo "║   バックエンドサーバー起動準備          ║"
echo "╚════════════════════════════════════════╝"
echo ""

# ディレクトリ確認
if [ ! -f "server.js" ]; then
  echo "❌ Error: server.js が見つかりません"
  echo "smartreader ディレクトリで実行してください"
  exit 1
fi

echo "✓ ファイル確認完了"
echo ""

# Node.js バージョン確認
if ! command -v node &> /dev/null; then
  echo "❌ Node.js がインストールされていません"
  echo "実行: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

NODE_VERSION=$(node --version)
echo "✓ Node.js: $NODE_VERSION"

# npm install 確認
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 依存パッケージをインストール中..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ npm install に失敗しました"
    exit 1
  fi
  echo "✓ インストール完了"
fi

echo ""
echo "🚀 サーバー起動中..."
echo ""

# サーバー起動
node server.js
