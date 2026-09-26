// 이미지 경로를 한 곳에 모아둔다.
// 나중에 미드저니 등으로 만든 실제 이미지로 바꿀 때는 이 파일의 경로 값만 수정하면 된다.
// 파일명은 배포(대소문자 구분 파일시스템) 호환을 위해 전부 영문 소문자+하이픈으로 통일했다.

export const ASSETS = {
  door: "./assets/images/door-bg.png",
  doorLeaf: "./assets/images/door-leaf.png",
  doorVoid: "./assets/images/door-void.png",
  room: "./assets/images/room-bg.png",
  wizard: "./assets/images/wizard-character.png",
  memo: "./assets/images/memo-blank.png",
  cauldron: "./assets/images/cauldron-bg.png",
  worryPaper: "./assets/images/worry-paper.png",
  // 이 파일은 아직 실제로 없다(기존부터 있던 갭). smoke 효과를 쓰려면
  // 이 경로에 이미지를 추가해야 한다.
  smoke: "./assets/images/smoke.png",
  dragMemo: "./assets/images/memo-drag.png",
  settingsPanel: "./assets/images/settings-panel.png",
};
