// 직업 메모장에 쓰는 직업 목록 (표시 순서 = 아래 순서)
// [이름, 썸네일 코드]  썸네일 주소: https://mafia42.com/chat/jobs/jobthumb_{코드}.png
// 코드가 틀려서 아이콘이 안 뜨면 이름 글씨만 보입니다. 그 줄의 코드만 고치면 됩니다.
// 코드가 null이면 "추리중" 이미지를 씁니다.
export const JOB_SECTIONS = [
  {
    title: null,
    rows: [
      [["마피아", "mafia"], ["경찰", "police"], ["자경단원", "vigilante"], ["요원", "agent"], ["형사", "inspector"]],
      [["의사", "doctor"], ["악인", "villain"], ["시민", "citizen"], ["추리중", null]],
    ],
  },
  {
    title: "마피아 팀",
    rows: [
      [["짐승인간", "beastman"], ["스파이", "spy"], ["마담", "madam"], ["마녀", "witch"], ["과학자", "scientist"]],
      [["도둑", "thief"], ["사기꾼", "pretender"], ["청부업자", "hitman"], ["대부", "god_father"]],
    ],
  },
  {
    title: "시민 팀",
    rows: [
      [["군인", "soldier"], ["정치인", "politician"], ["영매", "shaman"], ["연인", "couple"], ["기자", "reporter"]],
      [["건달", "gangster"], ["사립탐정", "detective"], ["도굴꾼", "ghoul"], ["테러리스트", "terrorist"], ["성직자", "priest"]],
      [["예언자", "prophet"], ["판사", "judge"], ["간호사", "nurse"], ["마술사", "magician"], ["해커", "hacker"]],
      [["심리학자", "mentalist"], ["용병공무원", "mercenary"], ["비밀결사", "cabal"], ["파파라치", "paparazzi"]],
      [["최면술사", "hypnotist"], ["점쟁이", "fortuneteller"]],
    ],
  },
];
