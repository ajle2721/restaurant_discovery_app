const restaurantData = [
  {
    "name": "Luguo Cafe / Z Space",
    "address": "112臺灣臺北市北投區學園路1號北藝大校園內-關渡美術館2樓 1號 二樓, 關渡美術館",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=Luguo+Cafe+/+Z+Space&query_place_id=ChIJ1-Osh6CvQjQRE5DbEVM_GGk",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": false
    },
    "ai_summary": "空間看似較為寬敞，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "咖啡實驗室",
    "address": "100臺灣臺北市中正區忠孝東路二段64巷6號",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=咖啡實驗室&query_place_id=ChIJ13WfAXupQjQRPSGT92Z0z88",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "Atlas Brunch & Pasta 亞斯義大利麵",
    "address": "114臺灣臺北市內湖區民權東路六段296巷56號",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=Atlas+Brunch+&+Pasta+亞斯義大利麵&query_place_id=ChIJ39G4keGtQjQRd5mdfKmFUlA",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "森優咖啡 Tribu Cafe",
    "address": "110臺灣臺北市信義區崇德街74號",
    "rating": "4.7",
    "url": "https://www.google.com/maps/search/?api=1&query=森優咖啡+Tribu+Cafe&query_place_id=ChIJ4QL3EsjWDRQRAj_JjQvT6GM",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": false
    },
    "ai_summary": "空間看似較為寬敞，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "BACKMOUNT.後山咖啡/平日不限時咖啡廳/後山埤美食/下午茶外送/寵物友善/親子友善/南港公園餐廳",
    "address": "115臺灣臺北市南港區福德街373巷23號",
    "rating": "4.3",
    "url": "https://www.google.com/maps/search/?api=1&query=BACKMOUNT.後山咖啡/平日不限時咖啡廳/後山埤美食/下午茶外送/寵物友善/親子友善/南港公園餐廳&query_place_id=ChIJ6ZLHHYmrQjQRKeVAlEcW3Jk",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "咖啡俱樂部 COFFEE CLUB",
    "address": "100臺灣臺北市中正區忠孝西路一段122號",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=咖啡俱樂部+COFFEE+CLUB&query_place_id=ChIJ7-iV4NmpQjQR0aadctCL7hk",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "HSQ COFFEE",
    "address": "114臺灣臺北市內湖區民權東路六段121之1號",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=HSQ+COFFEE&query_place_id=ChIJ8e4b2r2tQjQRR3LLK-OpD_4",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": []
  },
  {
    "name": "安好食 和平店",
    "address": "106臺灣臺北市大安區辛亥路二段201號1樓",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=安好食+和平店&query_place_id=ChIJA7xCuqirQjQRGwBOltepJQk",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "找諶 Chen’s Brunch",
    "address": "115臺灣臺北市南港區昆陽街58號",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=找諶+Chen’s+Brunch&query_place_id=ChIJA9vu3HqrQjQRWhhwjOBFkcA",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "大樹先生的家",
    "address": "106臺灣臺北市大安區潮州街38號",
    "rating": "4.2",
    "url": "https://www.google.com/maps/search/?api=1&query=大樹先生的家&query_place_id=ChIJaSZ-CpupQjQRaqvVbaJ4FaM",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區"
    ]
  },
  {
    "name": "Q Burger 中山農安店(直營)",
    "address": "104臺灣臺北市中山區農安街170號",
    "rating": "4.1",
    "url": "https://www.google.com/maps/search/?api=1&query=Q+Burger+中山農安店(直營)&query_place_id=ChIJB3tqu_WpQjQR4k8D1g1BPUI",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "子木咖啡",
    "address": "105臺灣臺北市松山區延壽街412號",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=子木咖啡&query_place_id=ChIJBy9WAHyrQjQRCDU8Cp-PLAc",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "常見家庭客人",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "Second Floor 貳樓西湖店",
    "address": "114臺灣臺北市內湖區內湖路一段300號",
    "rating": "4.3",
    "url": "https://www.google.com/maps/search/?api=1&query=Second+Floor+貳樓西湖店&query_place_id=ChIJCyKuHW-sQjQRLbLgae6QWSU",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "Timama kitchen",
    "address": "114臺灣臺北市內湖區江南街71巷16弄32號",
    "rating": "4.2",
    "url": "https://www.google.com/maps/search/?api=1&query=Timama+kitchen&query_place_id=ChIJd8JMXwKtQjQRtcgmBVKpiOs",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "歡樂便所主題餐廳",
    "address": "111臺灣臺北市士林區文林路173號2F",
    "rating": "4.7",
    "url": "https://www.google.com/maps/search/?api=1&query=歡樂便所主題餐廳&query_place_id=ChIJd9QKFaWuQjQRLPGO-ltaXj4",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "常見家庭客人",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "早點醒",
    "address": "110臺灣臺北市信義區信義路五段150巷14弄12號",
    "rating": "4.3",
    "url": "https://www.google.com/maps/search/?api=1&query=早點醒&query_place_id=ChIJeY-MOqSrQjQR30bwWOZVEcA",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "象園咖啡內湖店",
    "address": "114臺灣臺北市內湖區內湖路二段192號",
    "rating": "4.2",
    "url": "https://www.google.com/maps/search/?api=1&query=象園咖啡內湖店&query_place_id=ChIJfepvyousQjQRq2rFXvS-esU",
    "attributes": {
      "high_chair_available": true,
      "kids_menu": true,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳提供嬰兒椅與兒童餐，氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "白菜小姐義式坊",
    "address": "114臺灣臺北市內湖區江南街71巷16弄40號",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=白菜小姐義式坊&query_place_id=ChIJFRwCvjitQjQRIUW3FrHbvlw",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "WilsonPark 威爾森公園 （Steak & Wine）",
    "address": "114臺灣臺北市內湖區民權東路六段125之1號",
    "rating": "4.7",
    "url": "https://www.google.com/maps/search/?api=1&query=WilsonPark+威爾森公園+（Steak+&+Wine）&query_place_id=ChIJfzjbheitQjQRa3PNwDBxq6E",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "巧果子",
    "address": "111臺灣臺北市士林區美崙街78號",
    "rating": "4.3",
    "url": "https://www.google.com/maps/search/?api=1&query=巧果子&query_place_id=ChIJhxfETbyuQjQRmD7M7JYcSXk",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "吉祥小館",
    "address": "111臺灣臺北市士林區雨農路31號",
    "rating": "4.3",
    "url": "https://www.google.com/maps/search/?api=1&query=吉祥小館&query_place_id=ChIJHZ56gp6uQjQRYaoc4dyx2lM",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "LOST and Found",
    "address": "106臺灣臺北市大安區敦化南路二段11巷50號",
    "rating": "4.1",
    "url": "https://www.google.com/maps/search/?api=1&query=LOST+and+Found&query_place_id=ChIJj9j7W2WrQjQR_UgmSg_0jkw",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "氣氛可能較輕鬆",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "UMAMI 金色三麥",
    "address": "110臺灣臺北市信義區松智路17號7樓",
    "rating": "4.2",
    "url": "https://www.google.com/maps/search/?api=1&query=UMAMI+金色三麥&query_place_id=ChIJKcM2uWSrQjQRfon8d41sbGo",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": false
    },
    "ai_summary": "空間看似較為寬敞，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "齊客咖啡 The Gathering Cafe",
    "address": "105臺灣臺北市松山區健康路8巷5號1樓",
    "rating": "4.8",
    "url": "https://www.google.com/maps/search/?api=1&query=齊客咖啡+The+Gathering+Cafe&query_place_id=ChIJLU4r6jurQjQRrr44krDtxuY",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "羽樂歐陸創意料理",
    "address": "105臺灣臺北市松山區南京東路四段162號",
    "rating": "4.7",
    "url": "https://www.google.com/maps/search/?api=1&query=羽樂歐陸創意料理&query_place_id=ChIJlVNfWeqrQjQRqO4OMZ0keZ4",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "遊霂食光 MuMu Land | 親子友善 | 健康餐點 | 外送便當",
    "address": "108臺灣臺北市萬華區西園路一段145號號店坊B2樓-7",
    "rating": "4.9",
    "url": "https://www.google.com/maps/search/?api=1&query=遊霂食光+MuMu+Land+|+親子友善+|+健康餐點+|+外送便當&query_place_id=ChIJM9l4kmOpQjQR9DEpCZWOlCM",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "打卡咖啡館迪化店",
    "address": "103臺灣臺北市大同區民生西路410號",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=打卡咖啡館迪化店&query_place_id=ChIJMUAZ63CpQjQRWLCOjtIeWkk",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "拉亞漢堡 臺北錦州",
    "address": "10491臺灣臺北市中山區錦州街341號",
    "rating": "4.3",
    "url": "https://www.google.com/maps/search/?api=1&query=拉亞漢堡+臺北錦州&query_place_id=ChIJMUwgSuKrQjQRizcHD3amAgk",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "Bistro O 避世所",
    "address": "106臺灣臺北市大安區師大路49巷3號2樓",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=Bistro+O+避世所&query_place_id=ChIJMXDWhoWpQjQRJvXnYteR7xE",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "氣氛可能較輕鬆"
    ]
  },
  {
    "name": "豐萃早午餐",
    "address": "104臺灣臺北市中山區撫順街9號",
    "rating": "4.2",
    "url": "https://www.google.com/maps/search/?api=1&query=豐萃早午餐&query_place_id=ChIJN2UHYkCpQjQRwdxAiIhBEac",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "Cafe La Connection",
    "address": "111臺灣臺北市士林區華聲街87號",
    "rating": "4.7",
    "url": "https://www.google.com/maps/search/?api=1&query=Cafe+La+Connection&query_place_id=ChIJnZy-IMqvQjQRhdX2w_4HcKs",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "Oneway CAFE玩味咖啡",
    "address": "106臺灣臺北市大安區和平東路二段118巷38-1號",
    "rating": "4.7",
    "url": "https://www.google.com/maps/search/?api=1&query=Oneway+CAFE玩味咖啡&query_place_id=ChIJO0Um2CmqQjQR1K5YldZ8Ibw",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "農人餐桌",
    "address": "100臺灣臺北市中正區重慶南路二段51號B1永豐餘大樓內",
    "rating": "4.0",
    "url": "https://www.google.com/maps/search/?api=1&query=農人餐桌&query_place_id=ChIJo5uKl5ipQjQRUDGwOBCHUWs",
    "attributes": {
      "high_chair_available": true,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳提供嬰兒椅與兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "Seeking Café",
    "address": "114臺灣臺北市內湖區成功路五段420巷11號",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=Seeking+Café&query_place_id=ChIJO6GuZb6sQjQRpNEp6bTjfr8",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "淘憩時光親子餐廳・義大利麵・手作燉飯・現烤鬆餅 | 包場派對 | 場地租借",
    "address": "104臺灣臺北市中山區松江路69巷5號",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=淘憩時光親子餐廳・義大利麵・手作燉飯・現烤鬆餅+|+包場派對+|+場地租借&query_place_id=ChIJoaP21WOpQjQRujwXUxC4FME",
    "attributes": {
      "high_chair_available": true,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳提供嬰兒椅與兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "常見家庭客人",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "撞個咖啡Drunkard cafe",
    "address": "105臺灣臺北市松山區寧安街5巷2-8號",
    "rating": "4.9",
    "url": "https://www.google.com/maps/search/?api=1&query=撞個咖啡Drunkard+cafe&query_place_id=ChIJoU4aSrSrQjQRcIkiMAukmFw",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": []
  },
  {
    "name": "Le Park Cafe公園咖啡館",
    "address": "104臺灣臺北市中山區遼寧街146號",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=Le+Park+Cafe公園咖啡館&query_place_id=ChIJoV5Vt-CrQjQRX99q0bEVO_k",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": [
      "氣氛可能較輕鬆"
    ]
  },
  {
    "name": "媽妳講親子餐廳 (MONEY JUMP)",
    "address": "114臺灣臺北市內湖區民善街127號2 樓",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=媽妳講親子餐廳+(MONEY+JUMP)&query_place_id=ChIJoZlomYarQjQRQ6dO-drU7eg",
    "attributes": {
      "high_chair_available": true,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳提供嬰兒椅與兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "又一間商行SPAGHETTI（無訂位服務，營業時間為最後點餐時間）",
    "address": "105臺灣臺北市松山區興安街192號",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=又一間商行SPAGHETTI（無訂位服務，營業時間為最後點餐時間）&query_place_id=ChIJp7WiKXyrQjQRUaxE_f4nw0A",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": []
  },
  {
    "name": "Soshow Bar & Restaurant",
    "address": "2f, No. 47號中山北路一段中山區臺北市臺灣 104",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=Soshow+Bar+&+Restaurant&query_place_id=ChIJpdkbPm2pQjQR8IPxB9Jy8rI",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "臺灣夯BAR串燒烤小店",
    "address": "10454臺灣臺北市中山區林森北路159巷4號",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=臺灣夯BAR串燒烤小店&query_place_id=ChIJQ3o7S2SpQjQRe_XmRyh4OBY",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": []
  },
  {
    "name": "MA CAFE",
    "address": "106臺灣臺北市大安區敦化南路二段11巷1號",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=MA+CAFE&query_place_id=ChIJQ6qFRCSrQjQRf5i_pjyKv0M",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": false
    },
    "ai_summary": "空間看似較為寬敞，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "HAIR SALON BISTRO餐酒館",
    "address": "108臺灣臺北市萬華區武昌街二段72號4樓",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=HAIR+SALON+BISTRO餐酒館&query_place_id=ChIJq_1oDQmpQjQRlMaxMHpr3PU",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": []
  },
  {
    "name": "別處咖啡 Away cafe",
    "address": "10089臺灣臺北市中正區羅斯福路三段244巷9弄2-1號",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=別處咖啡+Away+cafe&query_place_id=ChIJr52_JZ2pQjQRQ_UeWocNMTE",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "疆毒串烤-南京店",
    "address": "10491臺灣臺北市中山區南京東路二段214巷4號",
    "rating": "4.5",
    "url": "https://www.google.com/maps/search/?api=1&query=疆毒串烤-南京店&query_place_id=ChIJRe6azGGpQjQRFcbUze7j7IU",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "威尼斯義大利餐廳",
    "address": "104臺灣臺北市中山區松江路235巷19號1樓",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=威尼斯義大利餐廳&query_place_id=ChIJS-zNIF-pQjQR1vU1UjOlTM4",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "甲蟲秘境",
    "address": "111臺灣臺北市士林區克強路30號1樓",
    "rating": "4.7",
    "url": "https://www.google.com/maps/search/?api=1&query=甲蟲秘境&query_place_id=ChIJsS8FHNyvQjQRwtaRVpPMyAI",
    "attributes": {
      "high_chair_available": true,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳提供嬰兒椅與兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "心味酒餚居酒屋",
    "address": "10491臺灣臺北市中山區中山北路一段37號",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=心味酒餚居酒屋&query_place_id=ChIJsVHmQm6pQjQRykPNN0wJEd4",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": false
    },
    "ai_summary": "目前沒有明顯的專屬育兒設備資訊，但似乎仍是一般用餐的選項。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "ALL DAY ROASTING COMPANY 民生店",
    "address": "105臺灣臺北市松山區延壽街329號1樓",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=ALL+DAY+ROASTING+COMPANY+民生店&query_place_id=ChIJT2Oz1pKrQjQRRnykvhE9Bns",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "加爾第咖啡 (莊敬店)",
    "address": "110臺灣臺北市信義區吳興街269巷1弄21號",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=加爾第咖啡+(莊敬店)&query_place_id=ChIJTW_h3LSrQjQR1CQQteePjco",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": false
    },
    "ai_summary": "空間看似較為寬敞，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "樂雅樂餐廳 南港店",
    "address": "115臺灣臺北市南港區經貿二路66之1號",
    "rating": "4.0",
    "url": "https://www.google.com/maps/search/?api=1&query=樂雅樂餐廳+南港店&query_place_id=ChIJU0O98aesQjQRXsDcaOW-mzw",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "氣氛可能較輕鬆",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "聚聚樂",
    "address": "112臺灣臺北市北投區大業路300巷1號",
    "rating": "3.5",
    "url": "https://www.google.com/maps/search/?api=1&query=聚聚樂&query_place_id=ChIJUxfMbFauQjQRSwBqz9ahGgU",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "松果院子(午晚餐最後點餐時間：15:50/19:50)",
    "address": "105臺灣臺北市松山區富錦街449號",
    "rating": "4.2",
    "url": "https://www.google.com/maps/search/?api=1&query=松果院子(午晚餐最後點餐時間：15:50/19:50)&query_place_id=ChIJvdWMGY2rQjQRjF3SNuha2Tw",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "Ho'me廚房&親子友善餐廳",
    "address": "79號, 文湖街內湖區臺北市臺灣 11445",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=Ho'me廚房&親子友善餐廳&query_place_id=ChIJVQR_uWusQjQRYNp5Wdmei40",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "似乎有遊戲區",
      "氣氛可能較輕鬆",
      "店員對小朋友友善"
    ]
  },
  {
    "name": "樂雅樂餐廳 敦化店",
    "address": "105臺灣臺北市松山區敦化北路199巷9號",
    "rating": "4.1",
    "url": "https://www.google.com/maps/search/?api=1&query=樂雅樂餐廳+敦化店&query_place_id=ChIJvWWkxO6rQjQRHf_zc9VTcAE",
    "attributes": {
      "high_chair_available": true,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳提供嬰兒椅與兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "咖啡學人-傑克威爾 The Cafeist & Jackwell",
    "address": "100臺灣臺北市中正區羅斯福路二段118號",
    "rating": "4.6",
    "url": "https://www.google.com/maps/search/?api=1&query=咖啡學人-傑克威爾+The+Cafeist+&+Jackwell&query_place_id=ChIJV_SOYpqpQjQRA9cnwa-fRdc",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "CAFEPRO職人咖啡商行敦化店",
    "address": "105臺灣臺北市松山區八德路三段12巷52弄13號1樓CAFEPRO",
    "rating": "4.4",
    "url": "https://www.google.com/maps/search/?api=1&query=CAFEPRO職人咖啡商行敦化店&query_place_id=ChIJXV3RZsOrQjQRQvdi_pCOSvM",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": false
    },
    "ai_summary": "空間看似較為寬敞，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  },
  {
    "name": "筷子餐廳",
    "address": "106臺灣臺北市大安區光復南路290巷1號",
    "rating": "4.1",
    "url": "https://www.google.com/maps/search/?api=1&query=筷子餐廳&query_place_id=ChIJySwN8durQjQRpe5ndb5Zriw",
    "attributes": {
      "high_chair_available": true,
      "kids_menu": false,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供嬰兒椅，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "氣氛可能較輕鬆"
    ]
  },
  {
    "name": "麥味登 北市合江店",
    "address": "104臺灣臺北市中山區長春路238號",
    "rating": "4.2",
    "url": "https://www.google.com/maps/search/?api=1&query=麥味登+北市合江店&query_place_id=ChIJzf1Z-L-rQjQRJJ2JbvfGubs",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": []
  },
  {
    "name": "茉莉漢堡",
    "address": "111臺灣臺北市士林區天玉街38巷15號",
    "rating": "3.9",
    "url": "https://www.google.com/maps/search/?api=1&query=茉莉漢堡&query_place_id=ChIJZTNGjn2uQjQRtvfe01IHnzA",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": true,
      "spacious_seating": true,
      "kid_noise_tolerant": true
    },
    "ai_summary": "餐廳有提供兒童餐，空間似乎寬敞且對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "常見家庭客人"
    ]
  },
  {
    "name": "The Cup Coffee House 臺北",
    "address": "104臺灣臺北市中山區長春路21號1樓",
    "rating": "4.8",
    "url": "https://www.google.com/maps/search/?api=1&query=The+Cup+Coffee+House+臺北&query_place_id=ChIJ__cnHACpQjQRqPOSGWdlHbI",
    "attributes": {
      "high_chair_available": false,
      "kids_menu": false,
      "spacious_seating": false,
      "kid_noise_tolerant": true
    },
    "ai_summary": "氛圍可能對小朋友的聲音較為包容，整體環境可能對帶小孩的家庭較友善。",
    "signals": [
      "店員對小朋友友善"
    ]
  }
];