// three.js 0.169.0 (WebXR-Sandbox で Quest 3 実機検証済みのバージョン) を
// ESM として読み込み、非モジュールの script.js から参照できるよう
// window.THREE として公開するシム。
// script.js 側の waitForThree() リトライがこのモジュールの実行完了を待つため、
// <script> の実行順序に依存しない。
import * as THREE from './three.module.min.js';
window.THREE = THREE;
