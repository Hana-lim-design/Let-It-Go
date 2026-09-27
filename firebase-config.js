// Firebase 콘솔(console.firebase.google.com) > 프로젝트 설정 > 일반 탭 > "내 앱"에서
// 웹 앱을 하나 추가하면 아래와 똑같이 생긴 설정 객체를 보여준다. 그 값을 그대로
// 복사해서 아래에 붙여넣으면 된다. 이 프로젝트에서는 Realtime Database를 켜야 한다
// (콘솔 왼쪽 메뉴 > Build > Realtime Database > 데이터베이스 만들기, 테스트 모드로 시작).
//
// 이 값을 채우기 전까지는 stats.js가 자동으로 이 파일을 "설정 안 됨"으로 보고,
// 기기별 localStorage 저장(지금까지 쓰던 방식)으로 조용히 대체해서 동작한다 —
// 즉 지금 당장 값을 안 채워도 앱이 깨지지는 않는다.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkq6KNqpk7jnXkMDoyMGJlBig1tMBNfSY",
  authDomain: "let-it-go-b225b.firebaseapp.com",
  databaseURL: "https://let-it-go-b225b-default-rtdb.firebaseio.com",
  projectId: "let-it-go-b225b",
  storageBucket: "let-it-go-b225b.firebasestorage.app",
  messagingSenderId: "615936087780",
  appId: "1:615936087780:web:6dfd6e8ae7136855dabef1",
};
