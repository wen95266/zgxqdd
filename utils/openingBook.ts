import { Move, Position } from '../types';

export interface BookEntry {
    move: { from: [number, number], to: [number, number] }; // [x, y]
    name: string; // 布局名称
    desc: string; // 战术意图
    score: number; // 推荐分数
}

// 辅助函数：生成精简版 FEN (只看棋盘和轮次)
export const getSimpifiedFen = (board: any[][], turn: string): string => {
    let fen = "";
    for (let y = 0; y < 10; y++) {
        let empty = 0;
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) {
                empty++;
            } else {
                if (empty > 0) { fen += empty; empty = 0; }
                let c = p.type === 'horse' ? 'n' : 
                        p.type === 'chariot' ? 'r' : 
                        p.type === 'elephant' ? 'b' : 
                        p.type === 'advisor' ? 'a' : 
                        p.type === 'general' ? 'k' : 
                        p.type === 'cannon' ? 'c' : 'p';
                if (p.color === 'red') c = c.toUpperCase();
                fen += c;
            }
        }
        if (empty > 0) fen += empty;
        if (y < 9) fen += "/";
    }
    return `${fen} ${turn === 'red' ? 'w' : 'b'}`;
};

// ==================== 国手大师棋谱库 (程序化高精度定式) ====================
const OPENING_BOOK: Record<string, BookEntry[]> = {
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          7
        ],
        "to": [
          4,
          7
        ]
      },
      "name": "中炮局 (当头炮)",
      "desc": "炮二平五，控扼中路，最强刚猛开局",
      "score": 100
    },
    {
      "move": {
        "from": [
          6,
          9
        ],
        "to": [
          4,
          7
        ]
      },
      "name": "飞相局 (相三进五)",
      "desc": "扬相护中，固若金汤，以柔克刚",
      "score": 98
    },
    {
      "move": {
        "from": [
          2,
          6
        ],
        "to": [
          2,
          5
        ]
      },
      "name": "仙人指路 (兵七进一)",
      "desc": "投石问路，变化万千，高深莫测",
      "score": 98
    },
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "起马局 (马二进三)",
      "desc": "大将先登，稳中藏杀，不急于表态",
      "score": 95
    },
    {
      "move": {
        "from": [
          7,
          7
        ],
        "to": [
          5,
          7
        ]
      },
      "name": "过宫炮 (炮二平六)",
      "desc": "偏师攻击，快速集中兵力进攻一翼",
      "score": 94
    },
    {
      "move": {
        "from": [
          7,
          7
        ],
        "to": [
          3,
          7
        ]
      },
      "name": "士角炮 (炮二平四)",
      "desc": "含蓄稳重，蓄力反击，暗藏飞刀杀机",
      "score": 92
    }
  ],
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "屏风马 (马8进7)",
      "desc": "正规守法，双马互保，弹性十足",
      "score": 100
    },
    {
      "move": {
        "from": [
          1,
          0
        ],
        "to": [
          2,
          2
        ]
      },
      "name": "反宫马 (马2进3)",
      "desc": "反宫马首步，暗藏飞刀",
      "score": 98
    },
    {
      "move": {
        "from": [
          7,
          2
        ],
        "to": [
          4,
          2
        ]
      },
      "name": "顺手炮 (炮8平5)",
      "desc": "斗炮局！以攻对攻，互轰中路",
      "score": 95
    },
    {
      "move": {
        "from": [
          1,
          2
        ],
        "to": [
          4,
          2
        ]
      },
      "name": "列手炮 (炮2平5)",
      "desc": "小列手炮！背水争雄，险象环生",
      "score": 92
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "跳正马 (马二进三)",
      "desc": "巩固中兵，正常出子调动主力",
      "score": 100
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          7,
          0
        ]
      },
      "name": "亮出左直车 (车9平8)",
      "desc": "快速出大子，抢占八路要道",
      "score": 100
    }
  ],
  "rnbakabr1/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "亮出右直车 (车一平二)",
      "desc": "针锋相对，亮车争夺纵线",
      "score": 100
    }
  ],
  "rnbakabr1/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 b": [
    {
      "move": {
        "from": [
          1,
          0
        ],
        "to": [
          2,
          2
        ]
      },
      "name": "成双正马 (马2进3)",
      "desc": "屏风马阵型筑成，铜墙铁壁",
      "score": 100
    }
  ],
  "r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w": [
    {
      "move": {
        "from": [
          6,
          6
        ],
        "to": [
          6,
          5
        ]
      },
      "name": "进三兵 (兵三进一)",
      "desc": "活通相边马路，压制黑方7路马",
      "score": 98
    },
    {
      "move": {
        "from": [
          2,
          6
        ],
        "to": [
          2,
          5
        ]
      },
      "name": "进七兵 (兵七进一)",
      "desc": "制约黑方左翼屏风马",
      "score": 98
    }
  ],
  "r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C1N2/9/RNBAKABR1 b": [
    {
      "move": {
        "from": [
          2,
          3
        ],
        "to": [
          2,
          4
        ]
      },
      "name": "挺3卒 (卒3进1)",
      "desc": "挺起3卒，制约红方八路马",
      "score": 98
    }
  ],
  "r1bakabr1/9/1cn3nc1/p3p1p1p/2p6/6P2/P1P1P3P/1C2C1N2/9/RNBAKABR1 w": [
    {
      "move": {
        "from": [
          1,
          9
        ],
        "to": [
          2,
          7
        ]
      },
      "name": "进八路马 (马八进七)",
      "desc": "双马盘旋，红方阵型极度稳固",
      "score": 95
    }
  ],
  "r1bakabr1/9/1cn3nc1/p3p1p1p/2p6/6P2/P1P1P3P/1CN1C1N2/9/R1BAKABR1 b": [
    {
      "move": {
        "from": [
          2,
          0
        ],
        "to": [
          4,
          2
        ]
      },
      "name": "左象飞中 (象3进5)",
      "desc": "巩固中防，防止红炮急进冲中卒",
      "score": 95
    }
  ],
  "r2akabr1/9/1cn1b1nc1/p3p1p1p/2p6/6P2/P1P1P3P/1CN1C1N2/9/R1BAKABR1 w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          7,
          3
        ]
      },
      "name": "巡河车 (车二进六)",
      "desc": "深入敌境，过河压制黑方卒林线",
      "score": 95
    }
  ],
  "r2akabr1/9/1cn1b1nc1/p3p1pRp/2p6/6P2/P1P1P3P/1CN1C1N2/9/R1BAKAB2 b": [
    {
      "move": {
        "from": [
          6,
          2
        ],
        "to": [
          5,
          4
        ]
      },
      "name": "左马盘河 (马7进6)",
      "desc": "奔马跃过楚河，反击红车锋芒",
      "score": 95
    }
  ],
  "r1bakabr1/9/1cn3nc1/p1p1p1p1p/9/2P6/P3P1P1P/1C2C1N2/9/RNBAKABR1 b": [
    {
      "move": {
        "from": [
          6,
          3
        ],
        "to": [
          6,
          4
        ]
      },
      "name": "挺7卒 (卒7进1)",
      "desc": "挺7卒活马通路，正面对抗",
      "score": 98
    }
  ],
  "r1bakabr1/9/1cn3nc1/p1p1p3p/6p2/2P6/P3P1P1P/1C2C1N2/9/RNBAKABR1 w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          7,
          3
        ]
      },
      "name": "过河车 (车二进六)",
      "desc": "抢占卒林高位，锁死黑马活动",
      "score": 96
    },
    {
      "move": {
        "from": [
          1,
          9
        ],
        "to": [
          2,
          7
        ]
      },
      "name": "跳八路马 (马八进七)",
      "desc": "全军动员",
      "score": 95
    }
  ],
  "r1bakabr1/9/1cn3nc1/p1p1p2Rp/6p2/2P6/P3P1P1P/1C2C1N2/9/RNBAKAB2 b": [
    {
      "move": {
        "from": [
          7,
          2
        ],
        "to": [
          7,
          6
        ]
      },
      "name": "平炮过河 (炮8进4)",
      "desc": "过河封车，经典屏风马反击利器",
      "score": 96
    }
  ],
  "r1bakabnr/9/1cn4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "跳正马 (马二进三)",
      "desc": "稳固出子",
      "score": 100
    }
  ],
  "r1bakabnr/9/1cn4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          7,
          2
        ],
        "to": [
          5,
          2
        ]
      },
      "name": "士角炮 (炮8平6)",
      "desc": "反宫马标志性士角炮，防守反击",
      "score": 98
    }
  ],
  "r1bakabnr/9/1cn2c3/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "开右直车 (车一平二)",
      "desc": "快速出车控制要津",
      "score": 98
    }
  ],
  "r1bakabnr/9/1cn2c3/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "跳左马 (马8进7)",
      "desc": "双马内收，士角发炮",
      "score": 98
    }
  ],
  "r1bakab1r/9/1cn2cn2/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w": [
    {
      "move": {
        "from": [
          6,
          6
        ],
        "to": [
          6,
          5
        ]
      },
      "name": "进三兵 (兵三进一)",
      "desc": "破反宫马最有效着法，挺兵活马",
      "score": 96
    }
  ],
  "r1bakab1r/9/1cn2cn2/p1p1p1p1p/9/6P2/P1P1P3P/1C2C1N2/9/RNBAKABR1 b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          7,
          0
        ]
      },
      "name": "出直车 (车9平8)",
      "desc": "黑方直车迎战",
      "score": 96
    }
  ],
  "rnbakabnr/9/1c2c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "跳正马 (马二进三)",
      "desc": "保护中路，防止黑炮闪击",
      "score": 100
    }
  ],
  "rnbakabnr/9/1c2c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          1,
          0
        ],
        "to": [
          2,
          2
        ]
      },
      "name": "跳正马 (马2进3)",
      "desc": "黑方也跳正马，对仗工整",
      "score": 100
    }
  ],
  "r1bakabnr/9/1cn1c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "出直车 (车一平二)",
      "desc": "抢占直车主动权",
      "score": 100
    },
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          8,
          8
        ]
      },
      "name": "起横车 (车一进一)",
      "desc": "红起横车！准备巡河或调动过宫",
      "score": 96
    }
  ],
  "r1bakabnr/9/1cn1c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          8,
          1
        ]
      },
      "name": "起横车 (车9进1)",
      "desc": "顺炮经典！横车过宫调动灵活",
      "score": 96
    }
  ],
  "r1bakabn1/8r/1cn1c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          7,
          5
        ]
      },
      "name": "巡河车 (车二进四)",
      "desc": "巡河压制，封锁黑方过河点",
      "score": 95
    }
  ],
  "r1bakabn1/8r/1cn1c4/p1p1p1p1p/9/7R1/P1P1P1P1P/1C2C1N2/9/RNBAKAB2 b": [
    {
      "move": {
        "from": [
          8,
          1
        ],
        "to": [
          4,
          1
        ]
      },
      "name": "肋道肋车 (车9平4)",
      "desc": "抢占四路肋道，直指红方九宫",
      "score": 95
    }
  ],
  "rnbakabnr/9/4c2c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "跳正马 (马二进三)",
      "desc": "巩固中线",
      "score": 100
    }
  ],
  "rnbakabnr/9/4c2c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          1,
          0
        ],
        "to": [
          2,
          2
        ]
      },
      "name": "跳正马 (马2进3)",
      "desc": "快速出马",
      "score": 96
    }
  ],
  "r1bakabnr/9/2n1c2c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "出直车 (车一平二)",
      "desc": "快速出动强子",
      "score": 100
    }
  ],
  "r1bakabnr/9/2n1c2c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKABR1 b": [
    {
      "move": {
        "from": [
          0,
          0
        ],
        "to": [
          1,
          0
        ]
      },
      "name": "右直车 (车1平2)",
      "desc": "黑方快速亮车对峙",
      "score": 96
    }
  ],
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2B2C1/9/RNBAKA1NR b": [
    {
      "move": {
        "from": [
          7,
          2
        ],
        "to": [
          4,
          2
        ]
      },
      "name": "架左中炮 (炮8平5)",
      "desc": "正面直击红方中路空隙",
      "score": 96
    },
    {
      "move": {
        "from": [
          2,
          3
        ],
        "to": [
          2,
          4
        ]
      },
      "name": "挺3卒 (卒3进1)",
      "desc": "制约红马，争夺战略空间",
      "score": 96
    }
  ],
  "rnbakabnr/9/1c2c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2B2C1/9/RNBAKA1NR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "正马护中 (马二进三)",
      "desc": "出马保护中兵",
      "score": 98
    }
  ],
  "rnbakabnr/9/1c2c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2B1NC1/9/RNBAKA2R b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "跳左马 (马8进7)",
      "desc": "正常运子出击",
      "score": 96
    }
  ],
  "rnbakab1r/9/1c2c1n2/p1p1p1p1p/9/9/P1P1P1P1P/1C2B1NC1/9/RNBAKA2R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "出直车 (车一平二)",
      "desc": "占领二路要道",
      "score": 98
    }
  ],
  "rnbakab1r/9/1c2c1n2/p1p1p1p1p/9/9/P1P1P1P1P/1C2B1NC1/9/RNBAKA1R1 b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          7,
          0
        ]
      },
      "name": "出直车 (车9平8)",
      "desc": "黑方出车对抗",
      "score": 98
    }
  ],
  "rnbakabr1/9/1c2c1n2/p1p1p1p1p/9/9/P1P1P1P1P/1C2B1NC1/9/RNBAKA1R1 w": [
    {
      "move": {
        "from": [
          2,
          6
        ],
        "to": [
          2,
          5
        ]
      },
      "name": "挺七兵 (兵七进一)",
      "desc": "疏通马路，伺机反击",
      "score": 95
    }
  ],
  "rnbakabnr/9/1c5c1/p3p1p1p/2p6/9/P1P1P1P1P/1C2B2C1/9/RNBAKA1NR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "起正马 (马二进三)",
      "desc": "顺势起马",
      "score": 98
    }
  ],
  "rnbakabnr/9/1c5c1/p3p1p1p/2p6/9/P1P1P1P1P/1C2B1NC1/9/RNBAKA2R b": [
    {
      "move": {
        "from": [
          1,
          0
        ],
        "to": [
          2,
          2
        ]
      },
      "name": "跳正马 (马2进3)",
      "desc": "黑方出马占中",
      "score": 96
    }
  ],
  "r1bakabnr/9/1cn4c1/p3p1p1p/2p6/9/P1P1P1P1P/1C2B1NC1/9/RNBAKA2R w": [
    {
      "move": {
        "from": [
          6,
          6
        ],
        "to": [
          6,
          5
        ]
      },
      "name": "挺三兵 (兵三进一)",
      "desc": "对挺三兵，两军互控",
      "score": 95
    }
  ],
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/2P6/P3P1P1P/1C5C1/9/RNBAKABNR b": [
    {
      "move": {
        "from": [
          7,
          2
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "卒底炮 (炮8平7)",
      "desc": "瞄准红方薄弱马路，针锋相对",
      "score": 96
    },
    {
      "move": {
        "from": [
          6,
          0
        ],
        "to": [
          4,
          2
        ]
      },
      "name": "飞中象 (象7进5)",
      "desc": "以稳为主，中路厚实",
      "score": 95
    }
  ],
  "rnbakabnr/9/1c4c2/p1p1p1p1p/9/2P6/P3P1P1P/1C5C1/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          7
        ],
        "to": [
          4,
          7
        ]
      },
      "name": "架当头炮 (炮二平五)",
      "desc": "借势转当头炮，攻防易位",
      "score": 98
    }
  ],
  "rnbakabnr/9/1c4c2/p1p1p1p1p/9/2P6/P3P1P1P/1C2C4/9/RNBAKABNR b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "跳正马 (马8进7)",
      "desc": "护住中卒",
      "score": 96
    }
  ],
  "rnbakab1r/9/1c4n2/p1p1p1p1p/9/2P6/P3P1P1P/1C2C4/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "起正马 (马二进三)",
      "desc": "出马护中，步步争先",
      "score": 96
    }
  ],
  "rnbakab1r/9/1c4n2/p1p1p1p1p/9/2P6/P3P1P1P/1C2C1N2/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          7,
          0
        ]
      },
      "name": "出直车 (车9平8)",
      "desc": "开出主力大车",
      "score": 96
    }
  ],
  "rnbaka1nr/9/1c2b2c1/p1p1p1p1p/9/2P6/P3P1P1P/1C5C1/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          7
        ],
        "to": [
          4,
          7
        ]
      },
      "name": "架中炮 (炮二平五)",
      "desc": "见招拆招，果断架炮",
      "score": 96
    }
  ],
  "rnbaka1nr/9/1c2b2c1/p1p1p1p1p/9/2P6/P3P1P1P/1C2C4/9/RNBAKABNR b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "跳正马 (马8进7)",
      "desc": "保护中线",
      "score": 95
    }
  ],
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C4NC1/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "对起正马 (马8进7)",
      "desc": "正规应手，以静制动",
      "score": 95
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C4NC1/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          6,
          6
        ],
        "to": [
          6,
          5
        ]
      },
      "name": "挺三兵 (兵三进一)",
      "desc": "活马通津，打开通道",
      "score": 95
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/6P2/P1P1P3P/1C4NC1/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          6,
          3
        ],
        "to": [
          6,
          4
        ]
      },
      "name": "挺7卒 (卒7进1)",
      "desc": "针锋相对，互不退让",
      "score": 95
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p3p/6p2/6P2/P1P1P3P/1C4NC1/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "出直车 (车一平二)",
      "desc": "抢占大路",
      "score": 96
    }
  ],
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C3C3/9/RNBAKABNR b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "跳左正马 (马8进7)",
      "desc": "不慌不忙，守住中心",
      "score": 95
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C3C3/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "跳右马 (马二进三)",
      "desc": "顺势布子",
      "score": 95
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C3CN2/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          7,
          0
        ]
      },
      "name": "出直车 (车9平8)",
      "desc": "抢夺通道",
      "score": 95
    }
  ],
  "rnbakabr1/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C3CN2/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "出直车 (车一平二)",
      "desc": "两军对垒",
      "score": 95
    }
  ],
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C1C5/9/RNBAKABNR b": [
    {
      "move": {
        "from": [
          7,
          0
        ],
        "to": [
          6,
          2
        ]
      },
      "name": "跳左正马 (马8进7)",
      "desc": "以逸待劳，抢占要津",
      "score": 95
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C1C5/9/RNBAKABNR w": [
    {
      "move": {
        "from": [
          7,
          9
        ],
        "to": [
          6,
          7
        ]
      },
      "name": "起正马 (马二进三)",
      "desc": "步调协调，稳步推进",
      "score": 95
    }
  ],
  "rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C1C2N2/9/RNBAKAB1R b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          7,
          0
        ]
      },
      "name": "出直车 (车9平8)",
      "desc": "迅速出动主力大车",
      "score": 95
    }
  ],
  "rnbakabr1/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C1C2N2/9/RNBAKAB1R w": [
    {
      "move": {
        "from": [
          8,
          9
        ],
        "to": [
          7,
          9
        ]
      },
      "name": "出直车 (车一平二)",
      "desc": "对抢纵道",
      "score": 95
    }
  ],
  "r1bakabr1/9/1cn3nc1/p1p1p3p/6p2/2P6/P3P1P1P/1CN1C1N2/9/R1BAKABR1 b": [
    {
      "move": {
        "from": [
          0,
          0
        ],
        "to": [
          1,
          0
        ]
      },
      "name": "出右直车 (车1平2)",
      "desc": "双车齐出，黑方阵势极严",
      "score": 95
    }
  ],
  "r1bakabnr/9/1cn1c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/8R/RNBAKAB2 b": [
    {
      "move": {
        "from": [
          8,
          0
        ],
        "to": [
          7,
          0
        ]
      },
      "name": "出直车 (车9平8)",
      "desc": "黑方直车快速抢占要道",
      "score": 98
    }
  ],
  "r1bakabr1/9/1cn1c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/8R/RNBAKAB2 w": [
    {
      "move": {
        "from": [
          8,
          8
        ],
        "to": [
          4,
          8
        ]
      },
      "name": "横车占中 (车一平五)",
      "desc": "横车拱卫中路，双重压迫",
      "score": 95
    }
  ],
  "r1bakabr1/9/1cn1c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/4R4/RNBAKAB2 b": [
    {
      "move": {
        "from": [
          6,
          0
        ],
        "to": [
          4,
          2
        ]
      },
      "name": "补象护中 (象7进5)",
      "desc": "巩固中防，化解红方攻势",
      "score": 95
    }
  ]
};

export const getBookMove = (board: any[][], turn: string): BookEntry | null => {
    const fen = getSimpifiedFen(board, turn);
    const moves = OPENING_BOOK[fen];
    if (moves && moves.length > 0) {
        // 85% 选最高分，15% 选次优变着
        const random = Math.random();
        if (random > 0.85 && moves.length > 1) {
            return moves[1];
        }
        return moves[0];
    }
    return null;
};

export const getBookSuggestions = (board: any[][], turn: string): BookEntry[] => {
    const fen = getSimpifiedFen(board, turn);
    return OPENING_BOOK[fen] || [];
};
