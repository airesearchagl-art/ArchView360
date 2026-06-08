# ArchView360

D5 Renderなどで書き出した360°パノラマ画像をブラウザ上で確認できる、軽量な静的Webビューワーです。

![ArchView360 Screenshot](https://via.placeholder.com/900x400/0f1117/4f7cff?text=ArchView360)

---

## 特徴

- **サーバー不要** — 画像はローカルで処理。外部へのアップロードなし
- **ドラッグ＆ドロップ対応** — ファイルをそのままブラウザへ投げ込むだけ
- **マウス / タッチ / ピンチ操作** — PC・スマートフォン・タブレット対応
- **ホイールズーム** — FOV 30° ～ 100° でズーム
- **GitHub Pages / Vercel** どちらでもそのままデプロイ可能

---

## 使い方

### ローカルで開く

```bash
git clone https://github.com/airesearchagl-art/ArchView360.git
cd ArchView360
# ブラウザで index.html を開くだけで動作します
# （ファイルをダブルクリック、または以下で簡易サーバーを起動）
npx serve .
# → http://localhost:3000
```

> Three.js を CDN から読み込むため、初回はインターネット接続が必要です。

### 操作方法

| 操作 | 内容 |
|------|------|
| ドラッグ | 視点を移動 |
| スクロール | ズームイン／アウト |
| スワイプ | 視点を移動（タッチ） |
| ピンチ | ズーム（タッチ） |
| リセットボタン | 初期視点に戻る |
| 画像変更ボタン | 別の画像を選択 |

---

## 対応画像形式

| 形式 | 推奨仕様 |
|------|---------|
| JPEG (.jpg / .jpeg) | 2:1 の正距円筒図法（Equirectangular）推奨 |
| PNG (.png) | 同上 |
| WebP (.webp) | 同上 |

> **解像度の目安:** 4096×2048 ～ 8192×4096 px が最適です。  
> ファイルサイズは **100MB 以下**を推奨します（ブラウザのメモリ制約）。

---

## デプロイ方法

### GitHub Pages

1. このリポジトリを Fork またはクローン
2. リポジトリの **Settings → Pages** を開く
3. Source を `main` ブランチの `/ (root)` に設定
4. 数分後に `https://<username>.github.io/ArchView360/` で公開

### Vercel

```bash
npm i -g vercel
vercel --prod
```

または Vercel ダッシュボードでリポジトリをインポートするだけで自動デプロイされます。  
ビルドコマンドは不要です（静的サイト）。

---

## 技術スタック

- HTML5 / CSS3 / Vanilla JavaScript
- [Three.js r128](https://threejs.org/) — CDN 経由で読み込み（`node_modules` 不要）

---

## 注意点

- **オフライン環境** では Three.js CDN が読み込めないため動作しません。オフライン利用が必要な場合は `three.min.js` をローカルに配置してください。
- 非常に高解像度（8K以上）の画像はブラウザのメモリを大量に消費することがあります。
- iOS Safari では一部のファイル形式でテクスチャ読み込みに制限がある場合があります。JPEG 形式を推奨します。
- 画像はサーバーへ送信されません。すべての処理はブラウザ内で完結します。

---

## ライセンス

MIT License

---

*ArchView360 — 360° Panorama Viewer for Architecture*
