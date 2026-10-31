const API_BASE = "https://www.dnd5eapi.co/api/2014";
const OPEN5E_BASE = "https://api.open5e.com/v1";
const PAGE_SIZE = 18;
const DEFAULT_CAMPAIGN = {
  id: "eldoria",
  name: "As Cinzas de Eldoria",
  description: "Uma antiga profecia desperta sob as montanhas de Vhal’Tor.",
  background: "mountains",
  imageUrl: "",
};

const state = {
  spells: { catalog: null, results: [], visibleCount: PAGE_SIZE, query: "", level: "", requestId: 0 },
  tricks: { catalog: null, results: [], visibleCount: PAGE_SIZE, query: "", requestId: 0 },
  monsters: { results: [], visibleCount: PAGE_SIZE, query: "", provider: "all", documentSlug: "", documents: null, nameIndex: null, next: null, requestId: 0, imageCache: new Map() },
  combatants: loadStored("cronica-combatants", []),
  initiative: { creatures: [], selectedMonster: null, requestId: 0 },
  campaigns: loadCampaigns(),
  activeCampaignId: localStorage.getItem("cronica-active-campaign"),
  editingCampaignId: null,
  round: Number(localStorage.getItem("cronica-round")) || 1,
  currentCombatantId: localStorage.getItem("cronica-current-combatant") || null,
  notes: loadNotes(),
  activeNoteId: null,
  notesFilter: "all",
  notesDirty: false,
  customCreatures: loadCustomCreatures(),
  initiativeSpells: { catalog: null, results: [], requestId: 0 },
};

// Nomes em português (e apelidos) aceitos na busca, derivados das traduções completas de spells-pt.js.
const spellTranslations = Object.fromEntries(
  Object.entries(spellsPt).map(([englishName, spell]) => [englishName, [spell.name, ...(spell.aliases || [])]]),
);

const monsterTranslations = {
  "aboleth": ["abolete"],
  "animated armor": ["armadura animada"],
  "air elemental": ["elemental do ar"],
  "ankheg": ["ankheg"],
  "azer": ["azer"],
  "balor": ["balor"],
  "berserker": ["furioso"],
  "bulette": ["bulette"],
  "chuul": ["chuul"],
  "couatl": ["couatl"],
  "deva": ["deva"],
  "dretch": ["dretch"],
  "drider": ["drider"],
  "duergar": ["duergar"],
  "efreeti": ["ifrite"],
  "erinyes": ["erinyes"],
  "ettercap": ["ettercap"],
  "ettin": ["ettin"],
  "ghast": ["carniçal necrófago"],
  "glabrezu": ["glabrezu"],
  "gnoll": ["gnoll"],
  "goblin": ["goblin"],
  "grick": ["grick"],
  "grimlock": ["grimlock"],
  "hezrou": ["hezrou"],
  "hobgoblin": ["hobgoblin"],
  "kobold": ["kobold"],
  "kraken": ["kraken"],
  "lemure": ["lemure"],
  "magmin": ["magmin"],
  "marilith": ["marilith"],
  "medusa": ["medusa"],
  "merrow": ["merrow"],
  "nalfeshnee": ["nalfeshnee"],
  "oni": ["oni"],
  "orc": ["orc"],
  "otyugh": ["otyugh"],
  "planetar": ["planetar"],
  "pseudodragon": ["pseudodragão"],
  "quasit": ["quasit"],
  "quipper": ["quipper"],
  "rakshasa": ["rakshasa"],
  "remorhaz": ["remorhaz"],
  "roc": ["roc"],
  "roper": ["roper"],
  "sahuagin": ["sahuagin"],
  "solar": ["solar"],
  "stirge": ["stirge"],
  "tarrasque": ["tarrasque"],
  "troll": ["troll"],
  "vrock": ["vrock"],
  "worg": ["worg"],
  "xorn": ["xorn"],
  "awakened shrub": ["arbusto desperto"],
  "black bear": ["urso-negro"],
  "clay golem": ["golem de argila"],
  "cloud giant": ["gigante das nuvens"],
  "frost giant": ["gigante do gelo"],
  "giant ape": ["macaco gigante"],
  "giant badger": ["texugo gigante"],
  "giant bat": ["morcego gigante"],
  "giant boar": ["javali gigante"],
  "giant centipede": ["centopeia gigante"],
  "giant constrictor snake": ["serpente constritora gigante"],
  "giant crab": ["caranguejo gigante"],
  "giant crocodile": ["crocodilo gigante"],
  "giant eagle": ["águia gigante"],
  "giant elk": ["alce gigante"],
  "giant fire beetle": ["besouro-de-fogo gigante"],
  "giant frog": ["sapo gigante"],
  "giant goat": ["cabra gigante"],
  "giant hyena": ["hiena gigante"],
  "giant lizard": ["lagarto gigante"],
  "giant octopus": ["polvo gigante"],
  "giant owl": ["coruja gigante"],
  "giant poisonous snake": ["serpente venenosa gigante"],
  "giant rat": ["rato gigante"],
  "giant rat (diseased)": ["rato gigante doente"],
  "giant scorpion": ["escorpião gigante"],
  "giant sea horse": ["cavalo-marinho gigante"],
  "giant shark": ["tubarão gigante"],
  "giant toad": ["sapo gigante"],
  "giant vulture": ["abutre gigante"],
  "giant wasp": ["vespa gigante"],
  "giant weasel": ["doninha gigante"],
  "gray ooze": ["gosma cinzenta"],
  "iron golem": ["golem de ferro"],
  "magma mephit": ["mefito de magma"],
  "ochre jelly": ["gelatina ocre"],
  "spirit naga": ["naga espiritual"],
  "stone golem": ["golem de pedra"],
  "storm giant": ["gigante da tempestade"],
  "tribal warrior": ["guerreiro tribal"],
  "water elemental": ["elemental da água"],
  "earth elemental": ["elemental da terra"],
  "fire elemental": ["elemental do fogo"],
  "guardian naga": ["naga guardiã"],
  "hill giant": ["gigante da colina"],
  "half-red dragon veteran": ["veterano meio-dragão vermelho"],
  "minotaur skeleton": ["esqueleto de minotauro"],
  "ogre zombie": ["ogro zumbi"],
  "rug of smothering": ["tapete sufocante"],
  "saber-toothed tiger": ["tigre-dentes-de-sabre"],
  "succubus/incubus": ["súcubo/íncubo"],
  "swarm of bats": ["enxame de morcegos"],
  "swarm of beetles": ["enxame de besouros"],
  "swarm of centipedes": ["enxame de centopeias"],
  "swarm of insects": ["enxame de insetos"],
  "swarm of poisonous snakes": ["enxame de serpentes venenosas"],
  "swarm of quippers": ["enxame de quippers"],
  "swarm of rats": ["enxame de ratos"],
  "swarm of ravens": ["enxame de corvos"],
  "swarm of spiders": ["enxame de aranhas"],
  "swarm of wasps": ["enxame de vespas"],
  "tyrannosaurus rex": ["tiranossauro rex"],
  "vampire, bat form": ["vampiro, forma de morcego"],
  "vampire, mist form": ["vampiro, forma de névoa"],
  "vampire, vampire form": ["vampiro, forma verdadeira"],
  "werebear, bear form": ["urso-garou, forma de urso"],
  "werebear, human form": ["urso-garou, forma humana"],
  "werebear, hybrid form": ["urso-garou, forma híbrida"],
  "wereboar, boar form": ["javali-garou, forma de javali"],
  "wereboar, human form": ["javali-garou, forma humana"],
  "wereboar, hybrid form": ["javali-garou, forma híbrida"],
  "wererat, human form": ["rato-garou, forma humana"],
  "wererat, hybrid form": ["rato-garou, forma híbrida"],
  "wererat, rat form": ["rato-garou, forma de rato"],
  "weretiger, human form": ["tigre-garou, forma humana"],
  "weretiger, hybrid form": ["tigre-garou, forma híbrida"],
  "weretiger, tiger form": ["tigre-garou, forma de tigre"],
  "werewolf, human form": ["lobisomem, forma humana"],
  "werewolf, hybrid form": ["lobisomem, forma híbrida"],
  "werewolf, wolf form": ["lobisomem, forma de lobo"],
  "will-o'-wisp": ["fátuo"],
  "assassin": ["assassino"],
  "arakocra": ["arakocra"],
  "adult black dragon": ["dragão negro adulto"],
  "adult blue dragon": ["dragão azul adulto"],
  "adult brass dragon": ["dragão de latão adulto"],
  "adult bronze dragon": ["dragão de bronze adulto"],
  "adult copper dragon": ["dragão de cobre adulto"],
  "adult gold dragon": ["dragão dourado adulto"],
  "adult green dragon": ["dragão verde adulto"],
  "adult red dragon": ["dragão vermelho adulto"],
  "adult silver dragon": ["dragão prateado adulto"],
  "adult white dragon": ["dragão branco adulto"],
  "ancient black dragon": ["dragão negro ancião"],
  "ancient blue dragon": ["dragão azul ancião"],
  "ancient brass dragon": ["dragão de latão ancião"],
  "ancient bronze dragon": ["dragão de bronze ancião"],
  "ancient copper dragon": ["dragão de cobre ancião"],
  "ancient gold dragon": ["dragão dourado ancião"],
  "ancient green dragon": ["dragão verde ancião"],
  "ancient red dragon": ["dragão vermelho ancião"],
  "ancient silver dragon": ["dragão prateado ancião"],
  "ancient white dragon": ["dragão branco ancião"],
  "androsphinx": ["androesfinge"],
  "axe beak": ["bico-de-machado"],
  "deep gnome (svirfneblin)": ["gnomo das profundezas (svirfneblin)"],
  "black dragon wyrmling": ["filhote de dragão negro"],
  "blue dragon wyrmling": ["filhote de dragão azul"],
  "brass dragon wyrmling": ["filhote de dragão de latão"],
  "bronze dragon wyrmling": ["filhote de dragão de bronze"],
  "copper dragon wyrmling": ["filhote de dragão de cobre"],
  "gold dragon wyrmling": ["filhote de dragão dourado"],
  "green dragon wyrmling": ["filhote de dragão verde"],
  "red dragon wyrmling": ["filhote de dragão vermelho"],
  "silver dragon wyrmling": ["filhote de dragão prateado"],
  "white dragon wyrmling": ["filhote de dragão branco"],
  "young black dragon": ["dragão negro jovem"],
  "young blue dragon": ["dragão azul jovem"],
  "young brass dragon": ["dragão de latão jovem"],
  "young bronze dragon": ["dragão de bronze jovem"],
  "young copper dragon": ["dragão de cobre jovem"],
  "young gold dragon": ["dragão dourado jovem"],
  "young green dragon": ["dragão verde jovem"],
  "young red dragon": ["dragão vermelho jovem"],
  "young silver dragon": ["dragão prateado jovem"],
  "young white dragon": ["dragão branco jovem"],
  "awakened tree": ["árvore desperta"],
  "banshee": ["banshee"],
  "barghest": ["barghest"],
  "basilisk": ["basilisco"],
  "bandit captain": ["capitão dos bandidos", "capitão bandido"],
  "beholder": ["observador"],
  "brown bear": ["urso pardo"],
  "black dragon": ["dragão negro"],
  "black pudding": ["pudim negro"],
  "blue dragon": ["dragão azul"],
  "bugbear": ["bugurso"],
  "chimera": ["quimera"],
  "cockatrice": ["cocatriz"],
  "commoner": ["plebeu"],
  "copper dragon": ["dragão de cobre"],
  "cultist": ["cultista"],
  "death knight": ["cavaleiro da morte"],
  "darkmantle": ["manto sombrio"],
  "displacer beast": ["pantera deslocadora"],
  "dragon": ["dragão"],
  "drow": ["elfo negro"],
  "doppelganger": ["sósia", "doppelganger", "metamorfo"],
  "dryad": ["dríade"],
  "fire giant": ["gigante do fogo"],
  "giant": ["gigante"],
  "flameskull": ["caveira flamejante"],
  "flesh golem": ["golem de carne"],
  "gargoyle": ["gárgula"],
  "gelatinous cube": ["cubo gelatinoso"],
  "ghost": ["fantasma"],
  "ghoul": ["carniçal"],
  "gibbering mouther": ["boca murmurante"],
  "green dragon": ["dragão verde"],
  "griffon": ["grifo"],
  "guard": ["guarda"],
  "half-ogre": ["meio-ogro"],
  "harpy": ["harpia"],
  "hell hound": ["cão infernal"],
  "hydra": ["hidra"],
  "ice devil": ["diabo do gelo"],
  "giant spider": ["aranha gigante"],
  "giant wolf spider": ["aranha-lobo gigante"],
  "lich": ["liche"],
  "mimic": ["mímico"],
  "minotaur": ["minotauro"],
  "mummy": ["múmia"],
  "night hag": ["bruxa da noite"],
  "ogre": ["ogro"],
  "owlbear": ["coruja-urso"],
  "phase spider": ["aranha etérea"],
  "purple worm": ["verme púrpura"],
  "red dragon": ["dragão vermelho"],
  "spider": ["aranha"],
  "skeleton": ["esqueleto"],
  "specter": ["espectro"],
  "sprite": ["fada"],
  "stone giant": ["gigante da pedra"],
  "treant": ["ente"],
  "vampire": ["vampiro"],
  "vampire spawn": ["cria de vampiro"],
  "succubus": ["súcubo"],
  "werewolf": ["lobisomem"],
  "white dragon": ["dragão branco"],
  "winter wolf": ["lobo invernal"],
  "wolf": ["lobo"],
  "wraith": ["aparição"],
  "wyvern": ["serpe"],
  "yellow mold": ["mofo amarelo"],
  "zombie": ["zumbi"],
};
extraMonsters.forEach((monster) => { monsterTranslations[monster.name.toLowerCase()] = [monster.name_pt]; });

const monsterTypeTranslations = {
  aberration: t("Aberração"),
  beast: t("Besta"),
  celestial: t("Celestial"),
  construct: t("Constructo"),
  dragon: t("Dragão"),
  elemental: t("Elemental"),
  fey: t("Feérico"),
  fiend: t("Corruptor"),
  giant: t("Gigante"),
  humanoid: t("Humanoide"),
  monstrosity: t("Monstruosidade"),
  ooze: t("Gosma"),
  plant: t("Planta"),
  undead: t("Morto-vivo"),
};

const monsterNameParts = {
  adult: "adulto",
  ancient: "ancestral",
  young: "jovem",
  wyrmling: "filhote",
  black: "negro",
  blue: "azul",
  brass: "de latão",
  bronze: "de bronze",
  copper: "de cobre",
  gold: "dourado",
  green: "verde",
  red: "vermelho",
  silver: "prateado",
  white: "branco",
  air: "aéreo",
  earth: "terrestre",
  fire: "ígneo",
  water: "aquático",
  aboleth: "abolete",
  acolyte: "acólito",
  androsphinx: "androesfinge",
  archmage: "arquimago",
  ape: "macaco",
  armor: "armadura",
  assassin: "assassino",
  awakened: "desperto",
  axe: "machado",
  baboon: "babuíno",
  badger: "texugo",
  balor: "balor",
  bandit: "bandido",
  barbed: "farpado",
  basilisk: "basilisco",
  bat: "morcego",
  beak: "bico",
  bearded: "barbado",
  behir: "beir",
  berserker: "berserker",
  blink: "saltador",
  blood: "sanguinário",
  boar: "javali",
  bone: "ósseo",
  bugbear: "bugurso",
  bulette: "bulette",
  camel: "camelo",
  captain: "capitão",
  cat: "gato",
  centaur: "centauro",
  chain: "corrente",
  chimera: "quimera",
  chuul: "chuul",
  clay: "argila",
  cloaker: "espreitador",
  cloud: "nuvem",
  cockatrice: "cocatriz",
  commoner: "plebeu",
  constrictor: "constritor",
  snake: "serpente",
  couatl: "couatl",
  crab: "caranguejo",
  crocodile: "crocodilo",
  cult: "culto",
  fanatic: "fanático",
  cultist: "cultista",
  darkmantle: "manto sombrio",
  death: "morte",
  dog: "cão",
  devil: "diabo",
  gnome: "gnomo",
  deep: "profundezas",
  svirfneblin: "svirfneblin",
  deer: "cervo",
  deva: "deva",
  dire: "atroz",
  wolf: "lobo",
  djinni: "gênio",
  doppelganger: "metamorfo",
  horse: "cavalo",
  draft: "carga",
  turtle: "tartaruga",
  dretch: "dretch",
  drider: "drider",
  drow: "drow",
  druid: "druida",
  dryad: "dríade",
  duergar: "duergar",
  dust: "poeira",
  mephit: "mefito",
  eagle: "águia",
  efreeti: "efreeti",
  elephant: "elefante",
  elk: "alce",
  erinyes: "erinyes",
  ettercap: "ettercap",
  ettin: "ettin",
  elemental: "elemental",
  flesh: "carne",
  flying: "voador",
  sword: "espada",
  frog: "sapo",
  frost: "gelo",
  gargoyle: "gárgula",
  gelatinous: "gelatinoso",
  cube: "cubo",
  ghast: "ghast",
  ghost: "fantasma",
  ghoul: "carniçal",
  centipede: "centopeia",
  beetle: "besouro",
  goat: "cabra",
  hyena: "hiena",
  lizard: "lagarto",
  octopus: "polvo",
  owl: "coruja",
  poisonous: "venenoso",
  rat: "rato",
  scorpion: "escorpião",
  sea: "marinho",
  shark: "tubarão",
  spider: "aranha",
  toad: "sapo",
  vulture: "abutre",
  wasp: "vespa",
  weasel: "doninha",
  gibbering: "balbuciante",
  mouther: "bocarra",
  glabrezu: "glabrezu",
  gladiator: "gladiador",
  gnoll: "gnoll",
  gorgon: "górgona",
  ooze: "gosma",
  hag: "bruxa",
  grick: "grick",
  griffon: "grifo",
  grimlock: "grimlock",
  guard: "guarda",
  guardian: "guardião",
  naga: "naga",
  gynosphinx: "ginosfinge",
  half: "meio",
  harpy: "harpia",
  hawk: "falcão",
  hound: "cão",
  hezrou: "hezrou",
  hill: "colina",
  hippogriff: "hipogrifo",
  hobgoblin: "hobgoblin",
  homunculus: "homúnculo",
  horned: "chifrudo",
  hunter: "caçador",
  hydra: "hidra",
  ice: "gelo",
  imp: "diabrete",
  invisible: "invisível",
  stalker: "perseguidor",
  iron: "ferro",
  jackal: "chacal",
  killer: "assassino",
  whale: "baleia",
  knight: "cavaleiro",
  kobold: "kobold",
  kraken: "kraken",
  lamia: "lâmia",
  lemure: "lemure",
  lich: "liche",
  lion: "leão",
  lizardfolk: "povo-lagarto",
  mage: "mago",
  magma: "magma",
  magmin: "magmin",
  mammoth: "mamute",
  manticore: "mantícora",
  marilith: "marilith",
  mastiff: "mastim",
  medusa: "medusa",
  merfolk: "povo-do-mar",
  merrow: "merrow",
  mimic: "mímico",
  minotaur: "minotauro",
  skeleton: "esqueleto",
  mule: "mula",
  mummy: "múmia",
  lord: "senhor",
  nalfeshnee: "nalfeshnee",
  nightmare: "pesadelo",
  noble: "nobre",
  ochre: "ocre",
  ogre: "ogro",
  zombie: "zumbi",
  oni: "oni",
  orc: "orc",
  otyugh: "otyugh",
  owlbear: "coruja-urso",
  panther: "pantera",
  pegasus: "pégaso",
  phase: "etérea",
  pit: "abissal",
  fiend: "corruptor",
  planetar: "planetar",
  plesiosaurus: "plesiossauro",
  polar: "polar",
  pony: "pônei",
  priest: "sacerdote",
  pseudo: "falso",
  dragon: "dragão",
  purple: "púrpura",
  worm: "verme",
  quasit: "quasit",
  quipper: "quipper",
  rakshasa: "rakshasa",
  raven: "corvo",
  reef: "recife",
  remorhaz: "remorhaz",
  rhinoceros: "rinoceronte",
  riding: "montaria",
  roc: "roc",
  roper: "roper",
  rug: "tapete",
  smothering: "sufocante",
  rust: "ferrugem",
  monster: "monstro",
  saber: "dentes-de-sabre",
  toothed: "",
  tiger: "tigre",
  sahuagin: "sahuagin",
  salamander: "salamandra",
  satyr: "sátiro",
  scout: "batedor",
  shadow: "sombra",
  shambling: "cambaleante",
  mound: "monte",
  shield: "escudo",
  shrieker: "gritador",
  solar: "solar",
  specter: "espectro",
  spirit: "espírito",
  sprite: "fada",
  spy: "espião",
  steam: "vapor",
  stirge: "stirge",
  stone: "pedra",
  golem: "golem",
  storm: "tempestade",
  succubus: "súcubo",
  incubus: "íncubo",
  swarm: "enxame",
  insects: "insetos",
  tarrasque: "tarrasque",
  thug: "capanga",
  treant: "ente",
  tribal: "tribal",
  warrior: "guerreiro",
  triceratops: "tricerátops",
  troll: "troll",
  tyrannosaurus: "tiranossauro",
  rex: "rex",
  unicorn: "unicórnio",
  vampire: "vampiro",
  form: "forma",
  mist: "névoa",
  spawn: "cria",
  veteran: "veterano",
  violet: "violeta",
  fungus: "fungo",
  vrock: "vrock",
  warhorse: "cavalo de guerra",
  humanoid: "humanoide",
  werebear: "urso-garou",
  wereboar: "javali-garou",
  wererat: "rato-garou",
  weretiger: "tigre-garou",
  werewolf: "lobisomem",
  wight: "carniçal",
  will: "vontade",
  wisp: "fátuo",
  winter: "invernal",
  worg: "worg",
  wraith: "aparição",
  wyvern: "serpe",
  xorn: "xorn",
  yellow: "amarelo",
  mold: "mofo",
  human: "humano",
  hybrid: "híbrida",
};

const spellSchoolTranslations = {
  abjuration: t("Abjuração"),
  conjuration: t("Conjuração"),
  divination: t("Adivinhação"),
  enchantment: t("Encantamento"),
  evocation: t("Evocação"),
  illusion: t("Ilusão"),
  necromancy: t("Necromancia"),
  transmutation: t("Transmutação"),
};

const spellClassTranslations = {
  bard: t("Bardo"),
  cleric: t("Clérigo"),
  druid: t("Druida"),
  sorcerer: t("Feiticeiro"),
  warlock: t("Bruxo"),
  wizard: t("Mago"),
};

const ruleCategories = {
  testes: t("Testes"),
  acoes: t("Ações em combate"),
  combate: t("Combate"),
  dano: t("Dano e cura"),
  magia: t("Magia"),
  condicoes: t("Condições"),
  exploracao: t("Exploração e descanso"),
};

// Resumos próprios das regras básicas de 2014, com distâncias em metros (1,5 m = 5 pés).
const quickRules = [
  // Testes
  { title: "Testes de atributo", category: "testes", tags: "perícia habilidade d20 CD dificuldade proficiência", summary: "Role 1d20 e some o modificador do atributo; com proficiência na perícia ou ferramenta, some também o bônus de proficiência. Igualar ou superar a CD é sucesso." },
  { title: "Classes de Dificuldade", category: "testes", tags: "CD fácil média moderada difícil muito difícil quase impossível", summary: "Referência para definir a CD de um teste.", points: ["Muito fácil: 5", "Fácil: 10", "Média: 15", "Difícil: 20", "Muito difícil: 25", "Quase impossível: 30"] },
  { title: "Testes de resistência", category: "testes", tags: "salvaguarda resistir efeito magia veneno armadilha", summary: "Usados para resistir a magias, armadilhas e outros perigos: 1d20 + modificador do atributo pedido + bônus de proficiência, se proficiente naquela resistência. A CD vem do efeito (por exemplo, a CD de magia de quem conjurou)." },
  { title: "Vantagem e desvantagem", category: "testes", tags: "d20 rolagem vantagem desvantagem dois dados", summary: "Role dois d20: com vantagem use o maior, com desvantagem o menor. Se as duas se aplicarem, elas se anulam, não importa quantas fontes existam de cada lado. Fontes múltiplas da mesma não acumulam." },
  { title: "Testes resistidos", category: "testes", tags: "disputa contestado agarrar furtividade empate", summary: "Cada envolvido faz o teste apropriado e o maior resultado vence. Em empate, a situação continua como estava antes da disputa." },
  { title: "Testes em grupo", category: "testes", tags: "grupo equipe metade todos furtividade sobrevivência", summary: "Quando o grupo tenta algo junto, todos rolam. Se pelo menos metade tiver sucesso, o grupo inteiro tem sucesso; caso contrário, o grupo falha." },
  { title: "Percepção passiva", category: "testes", tags: "sabedoria percepção passiva notar escondido emboscada", summary: "Valor fixo usado quando ninguém rola: 10 + todos os modificadores do teste de Sabedoria (Percepção). Vantagem soma +5; desvantagem subtrai 5." },
  { title: "Inspiração", category: "testes", tags: "inspiração recompensa interpretação vantagem", summary: "O Mestre concede inspiração por boa interpretação ou atitudes marcantes. Gaste-a para ter vantagem em uma jogada de ataque, teste de resistência ou teste de atributo. Um personagem tem no máximo uma inspiração por vez e pode passá-la a outro jogador." },

  // Ações em combate
  { title: "Seu turno", category: "acoes", tags: "turno ação movimento ação bônus reação interação objeto", summary: "Em cada turno você pode se mover até seu deslocamento e realizar uma ação, na ordem que quiser, podendo dividir o movimento antes e depois da ação.", points: ["Ação bônus: só se uma característica, magia ou regra conceder uma", "Reação: uma por rodada; volta no início do seu turno", "Interação gratuita: abrir uma porta ou sacar uma arma, uma vez por turno"] },
  { title: "Ações disponíveis", category: "acoes", tags: "atacar conjurar disparada desengajar esquivar ajudar esconder preparar procurar usar objeto", summary: "As ações que qualquer criatura pode escolher em seu turno.", points: ["Atacar: um ataque corpo a corpo ou à distância (ou mais, com Ataque Extra)", "Conjurar uma magia com tempo de 1 ação", "Disparada: ganha deslocamento extra igual ao seu deslocamento", "Desengajar: seu movimento não provoca ataques de oportunidade neste turno", "Esquivar: ataques de quem você vê têm desvantagem contra você e você tem vantagem em resistências de DES", "Ajudar, Esconder, Preparar, Procurar e Usar um objeto"] },
  { title: "Ajudar", category: "acoes", tags: "ajuda ação auxiliar aliado vantagem", summary: "Você auxilia um aliado: ele tem vantagem no próximo teste de atributo da tarefa em que você ajuda, ou no próximo ataque contra uma criatura a até 1,5 m de você, desde que ocorra antes do início do seu próximo turno." },
  { title: "Esconder", category: "acoes", tags: "esconder furtividade escondido oculto percepção passiva", summary: "Faça um teste de Destreza (Furtividade) contra a Percepção passiva de quem procura por você. Não é possível se esconder de quem consegue vê-lo claramente. Atacar revela sua posição." },
  { title: "Preparar", category: "acoes", tags: "preparar ação gatilho reação esperar", summary: "Escolha um gatilho perceptível e a ação (ou movimento) que fará em resposta. Quando o gatilho ocorrer, use sua reação para agir. Preparar uma magia exige concentração até liberá-la e gasta o espaço mesmo se não for usada." },
  { title: "Ataque de oportunidade", category: "acoes", tags: "reação alcance sair movimento desengajar", summary: "Quando uma criatura hostil que você vê sai do seu alcance usando o próprio movimento, você pode gastar a reação para um ataque corpo a corpo contra ela. Teleporte, Desengajar e deslocamento forçado não provocam." },
  { title: "Combate com duas armas", category: "acoes", tags: "duas armas leve ação bônus ataque segunda mão", summary: "Ao usar a ação Atacar com uma arma leve de corpo a corpo, você pode usar a ação bônus para atacar com outra arma leve na outra mão. Esse segundo ataque não soma o modificador de atributo ao dano, a menos que seja negativo." },
  { title: "Agarrar", category: "acoes", tags: "agarrar manobra atletismo acrobacia escapar", summary: "Substitui um dos ataques da ação Atacar. O alvo pode ser no máximo uma categoria de tamanho maior e você precisa de uma mão livre. Faça Força (Atletismo) contra Força (Atletismo) ou Destreza (Acrobacia) do alvo; se vencer, ele fica agarrado. Escapar exige uma ação e a mesma disputa." },
  { title: "Empurrar", category: "acoes", tags: "empurrar derrubar manobra atletismo caído", summary: "Substitui um dos ataques da ação Atacar contra alvo de até uma categoria maior. Força (Atletismo) contra Força (Atletismo) ou Destreza (Acrobacia) do alvo; se vencer, derruba-o (caído) ou o empurra 1,5 m para longe." },

  // Combate
  { title: "Iniciativa e surpresa", category: "combate", tags: "ordem combate iniciativa d20 destreza surpresa surpreso", summary: "No início do combate, todos rolam 1d20 + modificador de Destreza e agem do maior para o menor; o Mestre decide empates. Criaturas surpresas não se movem nem agem no primeiro turno e não podem reagir até o fim dele." },
  { title: "Jogada de ataque", category: "combate", tags: "ataque acerto CA 20 natural 1 natural proficiência", summary: "1d20 + modificador do atributo + bônus de proficiência (se proficiente com a arma). Igualar ou superar a CA do alvo acerta. Um 20 natural sempre acerta e um 1 natural sempre erra." },
  { title: "Acerto crítico", category: "combate", tags: "crítico 20 natural dano dobrado dados", summary: "Num 20 natural, role duas vezes todos os dados de dano do ataque (inclusive extras, como Ataque Furtivo) e some os modificadores uma única vez." },
  { title: "Ataques à distância", category: "combate", tags: "distância alcance longo arco besta adjacente", summary: "Atacar além do alcance normal, até o alcance longo, impõe desvantagem; além dele não é possível. Também há desvantagem se uma criatura hostil que o veja e não esteja incapacitada estiver a até 1,5 m de você." },
  { title: "Atacantes e alvos não vistos", category: "combate", tags: "invisível escuridão não visto vantagem desvantagem esconder", summary: "Atacar um alvo que você não vê impõe desvantagem (e você precisa adivinhar onde ele está). Se o alvo não vê você, você tem vantagem. Ao atacar, você revela sua posição, acertando ou não." },
  { title: "Cobertura", category: "combate", tags: "meia cobertura três quartos cobertura total CA destreza", summary: "Obstáculos entre você e o atacante protegem; vale apenas o maior grau de cobertura.", points: ["Meia: +2 na CA e nas resistências de DES", "Três quartos: +5 na CA e nas resistências de DES", "Total: não pode ser alvo direto de ataques nem de magias"] },
  { title: "Movimento e terreno difícil", category: "combate", tags: "deslocamento terreno difícil escalar nadar rastejar levantar", summary: "Você pode dividir o deslocamento ao longo do turno. Terreno difícil custa 1,5 m extra a cada 1,5 m. Escalar, nadar e rastejar também custam o dobro (o triplo em terreno difícil). Levantar-se de caído gasta metade do deslocamento." },
  { title: "Espaço e criaturas", category: "combate", tags: "espaço tamanho atravessar aliado inimigo ocupar", summary: "Você pode atravessar o espaço de um aliado, mas não terminar o movimento nele. Só atravessa o espaço de um inimigo se ele for pelo menos duas categorias de tamanho maior ou menor; esse espaço conta como terreno difícil." },
  { title: "Combate montado e submerso", category: "combate", tags: "montaria montar submerso água nadar", summary: "Montar ou desmontar gasta metade do deslocamento. Debaixo d'água, ataques corpo a corpo sem arma perfurante (adaga, lança, tridente, espada curta, azagaia) têm desvantagem; ataques à distância erram além do alcance normal e têm desvantagem dentro dele, exceto com bestas, redes e armas de arremesso como azagaias. Criaturas submersas têm resistência a dano de fogo." },

  // Dano e cura
  { title: "Resistência e vulnerabilidade", category: "dano", tags: "resistência vulnerabilidade imunidade metade dobro tipo de dano", summary: "Resistência reduz o dano daquele tipo à metade; vulnerabilidade o dobra; imunidade o anula. Aplique depois de todos os outros modificadores. Várias resistências ao mesmo tipo contam como uma só." },
  { title: "Pontos de vida temporários", category: "dano", tags: "PV temporários temp absorver não acumulam", summary: "Funcionam como um amortecedor: o dano é tirado deles primeiro. Não se acumulam (escolha manter os atuais ou os novos), não são cura e não contam para trazer alguém de 0 PV. Duram até acabarem ou até um descanso longo." },
  { title: "Cura", category: "dano", tags: "cura curar recuperar PV máximo 0 PV consciência", summary: "Some os PV recuperados aos atuais, sem passar do máximo. Qualquer cura em uma criatura com 0 PV a deixa consciente novamente." },
  { title: "Caindo a 0 PV", category: "dano", tags: "0 PV inconsciente morte morrendo dano massivo", summary: "A 0 PV você cai inconsciente e começa a fazer testes contra a morte. Se o dano que levou você a 0 PV, menos os PV que você tinha, igualar ou superar seu máximo de PV, a morte é instantânea (dano massivo)." },
  { title: "Testes contra a morte", category: "dano", tags: "morte salvaguarda morrendo 0 PV estabilizar 20 natural 1 natural", summary: "No início de cada turno a 0 PV, role 1d20 sem modificadores: 10 ou mais é sucesso.", points: ["Três sucessos: fica estável; três falhas: morre", "1 natural conta como duas falhas", "20 natural: recupera 1 PV", "Sofrer dano a 0 PV é uma falha (duas se for crítico)", "Os contadores zeram ao recuperar PV ou ficar estável"] },
  { title: "Estabilizar e nocautear", category: "dano", tags: "estabilizar medicina CD 10 nocaute nocautear não letal", summary: "Uma ação e um teste de Sabedoria (Medicina) CD 10 estabilizam uma criatura a 0 PV; estável, ela recupera 1 PV após 1d4 horas. Ao reduzir alguém a 0 PV com ataque corpo a corpo, você pode deixá-lo inconsciente e estável em vez de matá-lo." },
  { title: "Dano de queda", category: "dano", tags: "queda cair altura contundente", summary: "A criatura sofre 1d6 de dano contundente a cada 3 m de queda, até o máximo de 20d6, e aterrissa caída, a menos que evite o dano." },

  // Magia
  { title: "CD e ataque de magia", category: "magia", tags: "magia ataque acerto salvaguarda conjurador atributo conjuração", summary: "CD para resistir às suas magias = 8 + bônus de proficiência + modificador do atributo de conjuração. Ataque mágico = bônus de proficiência + o mesmo modificador." },
  { title: "Concentração", category: "magia", tags: "concentração magia dano teste constituição CD 10 incapacitado", summary: "Você mantém só uma magia de concentração por vez; conjurar outra encerra a primeira. Ao sofrer dano, faça um teste de resistência de Constituição com CD 10 ou metade do dano, o que for maior. Ficar incapacitado ou morrer também encerra a magia." },
  { title: "Espaços de magia e círculos superiores", category: "magia", tags: "espaço de magia slot nível superior círculo truque descanso", summary: "Conjurar uma magia gasta um espaço do círculo dela ou maior; em espaço maior, muitas magias ficam mais fortes. Truques não gastam espaços e melhoram com o nível do personagem. Os espaços voltam no descanso longo (bruxos recuperam no descanso curto)." },
  { title: "Magia como ação bônus", category: "magia", tags: "ação bônus magia truque mesmo turno", summary: "Se conjurar uma magia como ação bônus, você só pode conjurar outra magia no mesmo turno se for um truque com tempo de conjuração de 1 ação." },
  { title: "Componentes", category: "magia", tags: "verbal somático material foco bolsa de componentes", summary: "V exige falar em voz alta; S exige uma mão livre para gestos; M exige os materiais indicados. Uma bolsa de componentes ou foco de conjuração substitui materiais sem custo; os que têm preço ou são consumidos precisam estar com você." },
  { title: "Rituais", category: "magia", tags: "ritual dez minutos sem espaço", summary: "Magias com o descritor ritual podem ser conjuradas sem gastar espaço, levando 10 minutos a mais. Exige uma característica que permita conjurar rituais." },
  { title: "Combinando efeitos mágicos", category: "magia", tags: "acumular mesma magia sobrepor efeitos", summary: "Efeitos de magias diferentes se somam enquanto as durações se sobrepõem. A mesma magia conjurada várias vezes no mesmo alvo não acumula: vale o efeito mais forte enquanto durar." },

  // Condições
  { title: "Agarrado", category: "condicoes", tags: "condição agarrado grappled deslocamento", summary: "Deslocamento 0, sem bônus de deslocamento. Termina se quem agarra ficar incapacitado ou se um efeito tirar a criatura do alcance dele." },
  { title: "Amedrontado", category: "condicoes", tags: "condição amedrontado medo frightened", summary: "Desvantagem em testes de atributo e jogadas de ataque enquanto a fonte do medo estiver à vista. Não pode se aproximar dela voluntariamente." },
  { title: "Atordoado", category: "condicoes", tags: "condição atordoado stunned incapacitado", summary: "Incapacitado, não pode se mover e só fala com dificuldade. Falha automaticamente em resistências de FOR e DES. Ataques contra ele têm vantagem." },
  { title: "Caído", category: "condicoes", tags: "condição caído prone derrubado rastejar levantar", summary: "Só pode rastejar, a menos que gaste metade do deslocamento para se levantar. Tem desvantagem nas jogadas de ataque. Ataques contra ele têm vantagem se o atacante estiver a até 1,5 m; caso contrário, desvantagem." },
  { title: "Cego", category: "condicoes", tags: "condição cego blinded visão", summary: "Não enxerga e falha automaticamente em testes que dependem da visão. Ataques contra ele têm vantagem; os ataques dele têm desvantagem." },
  { title: "Contido", category: "condicoes", tags: "condição contido restrained teia preso", summary: "Deslocamento 0. Ataques contra ele têm vantagem; os ataques dele têm desvantagem. Tem desvantagem em resistências de Destreza." },
  { title: "Enfeitiçado", category: "condicoes", tags: "condição enfeitiçado charmed encantado", summary: "Não pode atacar quem o enfeitiçou nem escolhê-lo como alvo de habilidades ou efeitos mágicos nocivos. Quem enfeitiçou tem vantagem em testes de interação social com ele." },
  { title: "Envenenado", category: "condicoes", tags: "condição envenenado veneno poisoned", summary: "Desvantagem em jogadas de ataque e testes de atributo." },
  { title: "Exaustão", category: "condicoes", tags: "condição exaustão exausto cansaço níveis fome marcha forçada", summary: "Tem seis níveis cumulativos. Um descanso longo, com comida e água, reduz um nível.", points: ["1: desvantagem em testes de atributo", "2: deslocamento reduzido à metade", "3: desvantagem em ataques e testes de resistência", "4: máximo de PV reduzido à metade", "5: deslocamento 0", "6: morte"] },
  { title: "Incapacitado", category: "condicoes", tags: "condição incapacitado incapacitated", summary: "Não pode realizar ações nem reações." },
  { title: "Inconsciente", category: "condicoes", tags: "condição inconsciente unconscious desmaiado 0 PV", summary: "Incapacitado, não se move nem fala e não percebe o ambiente; larga o que segura e fica caído. Falha automaticamente em resistências de FOR e DES. Ataques contra ele têm vantagem, e acertos de atacantes a até 1,5 m são críticos." },
  { title: "Invisível", category: "condicoes", tags: "condição invisível invisible esconder", summary: "Não pode ser visto sem magia ou sentido especial e conta como densamente obscurecido para se esconder; ainda pode ser localizado por barulho ou rastros. Ataques contra ele têm desvantagem; os dele têm vantagem." },
  { title: "Paralisado", category: "condicoes", tags: "condição paralisado paralyzed imobilizar pessoa", summary: "Incapacitado, sem se mover nem falar. Falha automaticamente em resistências de FOR e DES. Ataques contra ele têm vantagem, e acertos de atacantes a até 1,5 m são críticos." },
  { title: "Petrificado", category: "condicoes", tags: "condição petrificado pedra petrified", summary: "Transformado em substância inanimada (geralmente pedra): incapacitado, sem se mover nem falar e alheio ao redor. Ataques contra ele têm vantagem; falha em resistências de FOR e DES; tem resistência a todo dano e imunidade a veneno e doenças." },
  { title: "Surdo", category: "condicoes", tags: "condição surdo deafened audição", summary: "Não ouve e falha automaticamente em testes que dependem da audição." },

  // Exploração e descanso
  { title: "Descanso curto", category: "exploracao", tags: "descanso curto pausa cura dados de vida hora", summary: "Pelo menos 1 hora de atividade leve. Ao final, você pode gastar Dados de Vida: role cada um e some o modificador de Constituição para recuperar PV. Algumas características voltam também." },
  { title: "Descanso longo", category: "exploracao", tags: "descanso longo sono recuperar PV dados de vida oito horas", summary: "Pelo menos 8 horas, com no máximo 2 horas de vigília leve. Ao final, recupera todos os PV e até metade do total de Dados de Vida (mínimo 1).", points: ["Exige ao menos 1 PV no início", "1 hora de caminhada, combate ou conjuração interrompe e obriga a recomeçar", "Só um descanso longo a cada 24 horas"] },
  { title: "Luz e visão", category: "exploracao", tags: "luz penumbra escuridão visão no escuro obscurecido", summary: "Área levemente obscurecida (penumbra, neblina) dá desvantagem em Percepção baseada em visão. Área densamente obscurecida (escuridão) deixa a criatura efetivamente cega ali dentro. Visão no escuro trata penumbra como luz plena e escuridão como penumbra, sem cores." },
  { title: "Ritmo de viagem", category: "exploracao", tags: "viagem ritmo rápido normal lento marcha forçada distância", summary: "Distâncias por minuto, hora e dia de 8 horas de marcha.", points: ["Rápido: 120 m/min, 6 km/h, 48 km/dia; −5 na Percepção passiva", "Normal: 90 m/min, 4,5 km/h, 36 km/dia", "Lento: 60 m/min, 3 km/h, 27 km/dia; permite usar Furtividade", "Marcha forçada: cada hora além de 8 exige resistência de CON (CD 10 + 1 por hora extra) ou 1 nível de exaustão"] },
  { title: "Saltos", category: "exploracao", tags: "salto pular distância altura força corrida", summary: "Com corrida de pelo menos 3 m, o salto em distância alcança 30 cm por ponto de Força e o salto em altura, 90 cm + 30 cm × modificador de Força. Sem corrida, ambos caem pela metade. Cada 30 cm saltado gasta 30 cm de deslocamento." },
  { title: "Sufocamento", category: "exploracao", tags: "sufocar respirar fôlego afogar submerso", summary: "Uma criatura prende a respiração por 1 + modificador de CON minutos (mínimo 30 segundos). Depois disso, sobrevive um número de rodadas igual ao modificador de CON (mínimo 1); no início do turno seguinte cai a 0 PV e começa a morrer." },
  { title: "Comida e água", category: "exploracao", tags: "comida água fome sede ração exaustão", summary: "Um personagem precisa de 0,5 kg de comida e cerca de 4 litros de água por dia. Aguenta 3 + modificador de CON dias sem comer (mínimo 1); depois, ganha 1 nível de exaustão por dia. Bebendo só metade da água, faça uma resistência de CON CD 15 ou ganhe 1 nível de exaustão; com menos que isso, o nível é automático." },
];

// O título em português identifica a regra; em inglês, título e textos vêm de quickRulesEn (i18n.js).
quickRules.forEach((rule) => {
  rule.key = rule.title;
  if (LANG === "en") Object.assign(rule, quickRulesEn[rule.key]);
});

const labels = {
  spells: t("Magias"),
  tricks: t("Truques"),
  monsters: t("Criaturas"),
  rules: t("Regras"),
  campaigns: t("Campanhas"),
  dashboard: t("Visão geral"),
  initiative: t("Iniciativa"),
  notes: t("Anotações"),
  backup: t("Dados e backup"),
};

const conditionDefs = {
  blinded: ["Cego", "Não enxerga e falha em testes que dependem da visão. Ataques contra ele têm vantagem; os ataques dele têm desvantagem."],
  charmed: ["Enfeitiçado", "Não pode atacar quem o enfeitiçou. Quem o enfeitiçou tem vantagem em interações sociais com ele."],
  deafened: ["Surdo", "Não ouve e falha em testes que dependem da audição."],
  frightened: ["Amedrontado", "Desvantagem em testes e ataques enquanto vir a fonte do medo; não pode se aproximar dela voluntariamente."],
  grappled: ["Agarrado", "Deslocamento 0. Termina se o agarrador ficar incapacitado ou se a criatura for afastada."],
  incapacitated: ["Incapacitado", "Não pode realizar ações nem reações."],
  invisible: ["Invisível", "Ataques contra ele têm desvantagem; os ataques dele têm vantagem."],
  paralyzed: ["Paralisado", "Incapacitado, sem se mover ou falar. Falha em salvaguardas de FOR e DES; ataques corpo a corpo a até 1,5 m são críticos."],
  petrified: ["Petrificado", "Transformado em pedra: incapacitado, resistente a todo dano e imune a veneno e doenças."],
  poisoned: ["Envenenado", "Desvantagem em jogadas de ataque e testes de atributo."],
  prone: ["Caído", "Só rasteja; levantar custa metade do deslocamento. Tem desvantagem nos ataques. Ataques contra ele a até 1,5 m têm vantagem; de mais longe, desvantagem."],
  restrained: ["Contido", "Deslocamento 0. Ataques contra ele têm vantagem; os dele e suas salvaguardas de DES têm desvantagem."],
  stunned: ["Atordoado", "Incapacitado, sem se mover e só fala com dificuldade. Falha em salvaguardas de FOR e DES; ataques contra ele têm vantagem."],
  unconscious: ["Inconsciente", "Incapacitado, caído e alheio ao redor. Falha em salvaguardas de FOR e DES; ataques corpo a corpo a até 1,5 m são críticos."],
  concentrating: ["Concentrando", "Mantém uma magia de concentração. Ao sofrer dano: salvaguarda de CON com CD 10 ou metade do dano, o que for maior."],
};
if (LANG === "en") Object.assign(conditionDefs, conditionDefsEn);

function loadStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Não foi possível ler "${key}" do armazenamento local.`, error);
    return fallback;
  }
}

function saveStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Não foi possível salvar "${key}" no armazenamento local.`, error);
    showToast(t("Não foi possível salvar. Verifique o espaço disponível no navegador."));
    return false;
  }
  return true;
}

function loadCampaigns() {
  const stored = loadStored("cronica-campaigns", []);
  const campaigns = Array.isArray(stored) ? stored : [];
  if (localStorage.getItem("cronica-campaigns-migrated") === "true") return campaigns;
  if (!campaigns.some((campaign) => campaign.id === DEFAULT_CAMPAIGN.id)) {
    campaigns.unshift({ ...DEFAULT_CAMPAIGN });
  }
  if (saveStored("cronica-campaigns", campaigns)) {
    try {
      localStorage.setItem("cronica-campaigns-migrated", "true");
    } catch (error) {
      console.error("Não foi possível registrar a migração das campanhas.", error);
    }
  }
  return campaigns;
}

function loadNotes() {
  const stored = loadStored("cronica-notes", null);
  if (Array.isArray(stored)) return stored.filter((note) => note && typeof note.id === "string");
  const legacy = loadStored("cronica-note", null);
  if (legacy && (legacy.title || legacy.content)) {
    return [{ id: "legacy", title: legacy.title || "Anotação", content: legacy.content || "", campaignId: "", updatedAt: Date.now() }];
  }
  return [];
}

function loadCustomCreatures() {
  const stored = loadStored("cronica-custom-creatures", []);
  return Array.isArray(stored)
    ? stored.filter((creature) => creature && typeof creature.name === "string").map((creature) => ({ ...creature, provider: "custom" }))
    : [];
}

async function requestApi(path) {
  const normalizedPath = path.startsWith("/api/2014")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const url = normalizedPath.startsWith("http")
    ? normalizedPath
    : `https://www.dnd5eapi.co${normalizedPath}`;
  // A API traduz nomes conforme o idioma do navegador; pedimos inglês porque
  // as traduções e descrições do app usam os nomes originais como chave.
  return requestExternalJson(url, "www.dnd5eapi.co", { "Accept-Language": "en" });
}

async function requestExternalJson(url, allowedHost, headers = {}) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== allowedHost) {
    throw new Error("A URL retornada pela API não pertence à fonte esperada.");
  }
  const response = await fetch(parsedUrl.href, { headers });
  if (!response.ok) {
    throw new Error(`A API respondeu com status ${response.status}.`);
  }
  return response.json();
}

function normalizeSearchTerm(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function resolveSearchTerm(query, translations) {
  const normalizedQuery = normalizeSearchTerm(query);
  for (const [englishName, portugueseNames] of Object.entries(translations)) {
    if (
      normalizeSearchTerm(englishName) === normalizedQuery ||
      portugueseNames.some((name) => normalizeSearchTerm(name) === normalizedQuery)
    ) return englishName;
  }
  return query;
}

function capitalizeFirst(text) {
  const value = String(text ?? "");
  return value.charAt(0).toLocaleUpperCase(LOCALE) + value.slice(1);
}

// Em inglês, nomes e textos da API são exibidos como vieram.
function getLocalizedName(name, translations) {
  if (LANG === "en") return name;
  return capitalizeFirst(translations[normalizeSearchTerm(name)]?.[0] || name);
}

function getSpellTranslation(name) {
  return LANG === "en" ? null : spellsPt[normalizeSearchTerm(name)] || null;
}

function formatMeters(feet) {
  return `${String(Math.round(feet * 0.3 * 10) / 10).replace(".", ",")} ${feet === 5 ? "metro" : "metros"}`;
}

// Tempo de conjuração, alcance e duração das magias, com distâncias em metros.
function localizeSpellValue(value) {
  if (!value || LANG === "en") return value || "";
  const fixed = {
    instantaneous: "Instantânea",
    touch: "Toque",
    self: "Pessoal",
    sight: "Visão",
    special: "Especial",
    unlimited: "Ilimitado",
    "until dispelled": "Até ser dissipada",
  };
  const units = {
    "bonus action": ["ação bônus", "ações bônus"],
    action: ["ação", "ações"],
    reaction: ["reação", "reações"],
    minute: ["minuto", "minutos"],
    hour: ["hora", "horas"],
    round: ["rodada", "rodadas"],
    day: ["dia", "dias"],
  };
  const text = String(value).trim();
  if (fixed[text.toLowerCase()]) return fixed[text.toLowerCase()];
  return text
    .replace(/^up to /i, "Até ")
    .replace(/\b(\d+)\s+(feet|foot)\b/gi, (_, amount) => formatMeters(Number(amount)))
    .replace(/\b(\d+)\s+miles?\b/gi, (_, amount) => `${String(Number(amount) * 1.5).replace(".", ",")} km`)
    .replace(/\b(\d+)\s+(bonus action|action|reaction|minute|hour|round|day)s?\b/gi, (_, amount, unit) => (
      `${amount} ${units[unit.toLowerCase()][amount === "1" ? 0 : 1]}`
    ));
}

function getLocalizedMonsterName(name) {
  if (LANG === "en") return name;
  const normalizedName = normalizeSearchTerm(name);
  const exactTranslation = monsterTranslations[normalizedName]?.[0];
  if (exactTranslation) return capitalizeFirst(exactTranslation);
  return capitalizeFirst(String(name).replace(/[(),']/g, "").split(/\s+/)
    .map((part) => monsterNameParts[normalizeSearchTerm(part)] ?? part)
    .filter(Boolean)
    .join(" "));
}

function getMonsterSearchName(query) {
  const exactName = resolveSearchTerm(query, monsterTranslations);
  if (exactName !== query) return exactName;
  const reverseParts = Object.entries(monsterNameParts)
    .filter(([, portuguese]) => portuguese)
    .map(([english, portuguese]) => [normalizeSearchTerm(portuguese), english])
    .sort(([first], [second]) => second.length - first.length);
  let normalizedQuery = normalizeSearchTerm(query);
  reverseParts.filter(([portuguese]) => portuguese.includes(" ")).forEach(([portuguese, english]) => {
    normalizedQuery = normalizedQuery.replace(
      new RegExp(`\\b${portuguese.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
      english,
    );
  });
  const reverseSingleWords = new Map(reverseParts.filter(([portuguese]) => !portuguese.includes(" ")));
  return normalizedQuery.split(/\s+/)
    .filter((part) => !["de", "do", "da", "dos", "das"].includes(part))
    .map((part) => reverseSingleWords.get(part) || part)
    .join(" ");
}

function getLocalizedMonsterType(type) {
  if (LANG !== "en" && monsterFieldsPt.type[normalizeSearchTerm(type)]) return monsterFieldsPt.type[normalizeSearchTerm(type)];
  return monsterTypeTranslations[normalizeSearchTerm(type)] || type;
}

function formatMeasure(feet) {
  return String(Math.round(Number(feet) * 0.3 * 10) / 10).replace(".", ",");
}

// Em português, toda distância em pés vira metros ("30 ft." → "9 m", "80/320 ft." → "24/96 m").
function feetToMeters(text) {
  if (LANG === "en") return String(text ?? "");
  return String(text ?? "")
    .replace(/(\d+)\/(\d+)\s*(?:ft\.?|feet|foot)(?![a-z])/gi, (_, short, long) => `${formatMeasure(short)}/${formatMeasure(long)} m`)
    .replace(/(\d+)(?:\s+|-)(?:ft\.?|feet|foot)(?![a-z])/gi, (_, amount) => `${formatMeasure(amount)} m`)
    .replace(/(\d+)(?:'|’)(?![\w'’])/g, (_, amount) => `${formatMeasure(amount)} m`)
    .replace(/(\d+)(?:\s+|-)inch(?:es)?\b/gi, (_, amount) => `${String(Number(amount) * 2.5).replace(".", ",")} cm`)
    .replace(/(\d+)(?:\s+|-)miles?\b/gi, (_, amount) => `${String(Number(amount) * 1.5).replace(".", ",")} km`);
}

function formatSpeedValue(value) {
  if (typeof value === "number") return LANG === "en" ? `${value} ft.` : `${formatMeasure(value)} m`;
  return feetToMeters(value);
}

function getLocalizedMovement(movement) {
  const movementTypes = {
    burrow: t("escavação"),
    climb: t("escalada"),
    fly: t("voo"),
    swim: t("natação"),
    walk: t("terrestre"),
  };
  return Object.entries(movement || {})
    .filter(([kind, value]) => value !== false && value != null && !(kind === "hover" && value !== true))
    .map(([kind, value]) => (kind === "hover" ? t("pairar") : `${movementTypes[kind] || kind}: ${formatSpeedValue(value)}`))
    .join(", ");
}

function getArmorClassValue(monster) {
  if (Array.isArray(monster.armor_class)) return monster.armor_class[0]?.value ?? "";
  return monster.armor_class ?? "";
}

function localizeMonsterField(group, value) {
  if (LANG === "en" || value == null) return value ?? "";
  return monsterFieldsPt[group][value] ?? monsterFieldsPt[group][String(value).toLowerCase()] ?? value;
}

// Termos combinados ("bludgeoning, piercing, and slashing from...") são traduzidos inteiros; o resto, palavra por palavra.
function localizeDamageText(value) {
  if (LANG === "en") return value;
  const text = String(value).trim();
  const whole = monsterFieldsPt.damage[text.toLowerCase()];
  if (whole) return whole;
  return Object.entries(monsterFieldsPt.damage)
    .sort(([first], [second]) => second.length - first.length)
    .reduce((result, [english, portuguese]) => result.replace(new RegExp(`\\b${english}\\b`, "gi"), portuguese), text)
    .replace(/\band\b/g, "e");
}

function localizeDamageList(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/;\s*/);
  return items.filter(Boolean).map((item) => localizeDamageText(typeof item === "object" ? item.name : item)).join("; ");
}

function localizeConditionList(value) {
  const items = Array.isArray(value) ? value.map((item) => (typeof item === "object" ? item.name : item)) : String(value || "").split(/,\s*/);
  return items.filter(Boolean).map((item) => {
    if (LANG === "en") return item;
    return monsterFieldsPt.condition[capitalizeFirst(String(item).trim().toLowerCase())] || item;
  }).join(", ");
}

function localizeLanguages(value) {
  const text = String(value || "").trim();
  if (!text || LANG === "en") return text;
  let result = text;
  monsterFieldsPt.languagePhrases.forEach(([english, portuguese]) => {
    result = result.split(english).join(portuguese);
  });
  Object.entries(monsterFieldsPt.languages)
    .sort(([first], [second]) => second.length - first.length)
    .forEach(([english, portuguese]) => {
      result = result.replace(new RegExp(`(^|[^\\p{L}])${english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "gu"), `$1${portuguese}`);
    });
  return feetToMeters(result);
}

function localizeSenses(value) {
  const labels = {
    darkvision: t("visão no escuro"),
    passive_perception: t("percepção passiva"),
    "passive perception": t("percepção passiva"),
    blindsight: t("visão às cegas"),
    tremorsense: t("sentido sísmico"),
    truesight: t("visão verdadeira"),
  };
  const extras = LANG === "en" ? [] : [["blind beyond this radius", "cego além desse raio"], ["or", "ou"], ["while deafened", "enquanto estiver surdo"]];
  const translateText = (text) => extras.reduce(
    (result, [english, portuguese]) => result.replace(new RegExp(`\\b${english}\\b`, "g"), portuguese),
    feetToMeters(text),
  );
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .filter(([, item]) => item != null && item !== "")
      .map(([key, item]) => `${labels[normalizeSearchTerm(key)] || key.replace(/_/g, " ")} ${translateText(item)}`)
      .join(", ");
  }
  if (LANG === "en") return String(value || "");
  return Object.entries(labels)
    .reduce((result, [english, label]) => result.replace(new RegExp(english.replace("_", " "), "gi"), label), translateText(value || ""));
}

function localizeArmor(monster) {
  if (!Array.isArray(monster.armor_class)) {
    const description = monster.armor_desc ? ` (${LANG === "en" ? monster.armor_desc : localizeMonsterField("armor", monster.armor_desc)})` : "";
    return `${monster.armor_class ?? "—"}${description}`;
  }
  return monster.armor_class.map((entry) => {
    const pieces = entry.armor?.length
      ? entry.armor.map((item) => localizeMonsterField("armor", item.name))
      : [entry.desc ? localizeMonsterField("armor", entry.desc) : localizeMonsterField("armor", entry.type)];
    const label = pieces.filter(Boolean).join(", ");
    return `${entry.value}${label && entry.type !== "dex" ? ` (${label})` : ""}`;
  }).join(", ");
}

function formatChallengeRating(value) {
  return { 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[value] ?? value ?? "—";
}

const ABILITY_LABELS = [
  ["strength", t("FOR")],
  ["dexterity", t("DES")],
  ["constitution", t("CON")],
  ["intelligence", t("INT")],
  ["wisdom", t("SAB")],
  ["charisma", t("CAR")],
];

const SKILL_NAMES_PT = Object.fromEntries(Object.entries(monsterFieldsPt.proficiency)
  .filter(([key]) => key.startsWith("Skill: "))
  .map(([key, value]) => [key.slice(7).toLowerCase(), value]));

// Testes de resistência e perícias: a D&D 5e API usa "proficiencies"; o Open5e, campos próprios.
function getMonsterSavesAndSkills(monster) {
  const signed = (value) => `${Number(value) >= 0 ? "+" : ""}${value}`;
  if (Array.isArray(monster.proficiencies)) {
    const pick = (prefix) => monster.proficiencies
      .filter((item) => item.proficiency?.name?.startsWith(prefix))
      .map((item) => `${LANG === "en" ? item.proficiency.name.slice(prefix.length) : localizeMonsterField("proficiency", item.proficiency.name)} ${signed(item.value)}`)
      .join(", ");
    return { saves: pick("Saving Throw: "), skills: pick("Skill: ") };
  }
  const saves = ABILITY_LABELS
    .filter(([key]) => monster[`${key}_save`] != null)
    .map(([key, label]) => `${label} ${signed(monster[`${key}_save`])}`)
    .join(", ");
  const skills = monster.skills && typeof monster.skills === "object"
    ? Object.entries(monster.skills)
      .map(([name, value]) => `${LANG === "en" ? capitalizeFirst(name) : SKILL_NAMES_PT[name.toLowerCase()] || capitalizeFirst(name)} ${signed(value)}`)
      .join(", ")
    : "";
  return { saves, skills };
}

function getMonsterProperties(monster) {
  const { saves, skills } = getMonsterSavesAndSkills(monster);
  return [
    [t("Testes de resistência"), saves],
    [t("Perícias"), skills],
    [t("Vulnerabilidades"), localizeDamageList(monster.damage_vulnerabilities)],
    [t("Resistências a dano"), localizeDamageList(monster.damage_resistances)],
    [t("Imunidades a dano"), localizeDamageList(monster.damage_immunities)],
    [t("Imunidades a condições"), localizeConditionList(monster.condition_immunities)],
    [t("Sentidos"), localizeSenses(monster.senses)],
    [t("Idiomas"), localizeLanguages(monster.languages)],
  ].filter(([, value]) => value);
}

function translateMonsterText(text) {
  const value = String(text ?? "").trim();
  if (LANG === "en") return value;
  return monsterTextPt[value] || feetToMeters(value);
}

function formatEntryUsage(usage) {
  if (!usage?.type) return "";
  if (usage.type === "recharge on roll") {
    const range = usage.min_value >= 6 ? "6" : `${usage.min_value}–6`;
    return ` (${t("Recarga {range}", { range })})`;
  }
  if (usage.type === "per day") return ` (${t("{times}/dia", { times: usage.times })})`;
  if (usage.type === "recharge after rest") return ` (${t("Recarrega após descanso curto ou longo")})`;
  return "";
}

function getMonsterEntryName(entry) {
  const name = entry.name || t("Habilidade");
  return `${LANG === "en" ? name : monsterEntryNamesPt[name] || name}${formatEntryUsage(entry.usage)}`;
}

function getMonsterFeatureGroups(monster) {
  return [
    [t("Traços"), monster.special_abilities || monster.traits],
    [t("Ações"), monster.actions],
    [t("Ações bônus"), monster.bonus_actions],
    [t("Reações"), monster.reactions],
    [t("Ações lendárias"), monster.legendary_actions],
    [t("Ações de covil"), monster.lair_actions],
  ].filter(([, entries]) => Array.isArray(entries) && entries.length);
}

function renderMonsterEntry(entry) {
  const [first, ...rest] = translateMonsterText(entry.desc || entry.description || "").split("\n").filter((line) => line.trim());
  return `<p><strong>${escapeHtml(getMonsterEntryName(entry))}.</strong> ${escapeHtml(first || "")}</p>${rest.length ? renderSpellText(rest) : ""}`;
}

function getMonsterSubtitle(monster) {
  const size = {
    tiny: t("Miúdo"),
    small: t("Pequeno"),
    medium: t("Médio"),
    large: t("Grande"),
    huge: t("Enorme"),
    gargantuan: t("Imenso"),
  }[normalizeSearchTerm(monster.size)] || monster.size || "";
  const subtype = monster.subtype ? ` (${localizeMonsterField("subtype", monster.subtype)})` : "";
  const alignment = localizeMonsterField("alignment", monster.alignment);
  return `${[size, getLocalizedMonsterType(monster.type || "")].filter(Boolean).join(" ")}${subtype}${alignment ? `, ${alignment}` : ""}`;
}

function buildMonsterTooltip(monster, tooltipId) {
  const abilities = ABILITY_LABELS
    .map(([key, label]) => `<span>${label} <strong>${escapeHtml(monster[key] ?? "—")}</strong></span>`).join("");
  const propertyMarkup = getMonsterProperties(monster).map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("");
  const features = getMonsterFeatureGroups(monster)
    .map(([heading, entries]) => `<section><h4>${heading}</h4>${entries.map(renderMonsterEntry).join("")}</section>`)
    .join("");
  const source = monster.document__title || (monster.provider === "open5e" ? "Open5e" : "SRD 2014");
  return `<div class="combatant-tooltip" id="${tooltipId}" role="tooltip">
    <div class="tooltip-heading"><strong>${escapeHtml(getLocalizedMonsterName(monster.name))}</strong><span>${t("ND")} ${escapeHtml(formatChallengeRating(monster.challenge_rating ?? monster.cr))}</span></div>
    <p class="tooltip-subtitle">${escapeHtml(getMonsterSubtitle(monster))}</p>
    <p class="tooltip-subtitle">${t("Fonte:")} ${escapeHtml(source)}</p>
    <p><strong>${t("CA")}:</strong> ${escapeHtml(localizeArmor(monster))} · <strong>${t("PV")}:</strong> ${escapeHtml(monster.hit_points ?? "—")} ${monster.hit_dice ? `(${escapeHtml(monster.hit_dice)})` : ""}</p>
    <p><strong>${t("Deslocamento")}:</strong> ${escapeHtml(getLocalizedMovement(monster.speed) || "—")}</p>
    <div class="tooltip-abilities">${abilities}</div>
    ${propertyMarkup ? `<section>${propertyMarkup}</section>` : ""}
    ${features}
  </div>`;
}

function renderCreatureSuggestions(creatures) {
  const listbox = document.querySelector("#creature-suggestions");
  listbox.innerHTML = creatures.map((creature, index) => `
    <button class="creature-suggestion" type="button" role="option" aria-selected="false" data-creature-index="${index}">
      <span><strong>${escapeHtml(getLocalizedMonsterName(creature.name))}</strong><small>${escapeHtml(creature.name)}</small></span>
      <span class="suggestion-source">${escapeHtml({ open5e: creature.document__title || "Open5e", extra: t("Outros livros"), custom: t("Minhas criaturas") }[creature.provider] || "SRD 2014")}</span>
    </button>`).join("");
  listbox.hidden = creatures.length === 0;
  document.querySelector("#combatant-name").setAttribute("aria-expanded", String(creatures.length > 0));
}

async function searchInitiativeCreatures(query) {
  const requestId = ++state.initiative.requestId;
  const listbox = document.querySelector("#creature-suggestions");
  const status = document.querySelector("#creature-search-status");
  if (query.trim().length < 2) {
    state.initiative.creatures = [];
    renderCreatureSuggestions([]);
    status.textContent = t("Digite pelo menos 2 letras para buscar no SRD 2014.");
    return;
  }
  status.textContent = t("Buscando no SRD 2014 e nas fontes abertas...");
  try {
    const searchTerm = getMonsterSearchName(query);
    const open5eParams = new URLSearchParams({ name__icontains: searchTerm, limit: "12" });
    const results = await Promise.allSettled([
      requestApi(`/monsters?${new URLSearchParams({ name: searchTerm })}`),
      requestExternalJson(`${OPEN5E_BASE}/monsters/?${open5eParams}`, "api.open5e.com"),
    ]);
    if (requestId !== state.initiative.requestId) return;
    const officialResult = results[0];
    const open5eResult = results[1];
    if (officialResult.status === "rejected") {
      console.error("Falha ao buscar criaturas no SRD 2014.", officialResult.reason);
    }
    if (open5eResult.status === "rejected") {
      console.error("Falha ao buscar criaturas no Open5e.", open5eResult.reason);
    }
    const officialCreatures = officialResult.status === "fulfilled"
      ? officialResult.value.results.map((creature) => ({ ...creature, provider: "dnd5e" }))
      : [];
    const open5eCreatures = open5eResult.status === "fulfilled"
      ? open5eResult.value.results.map((creature) => ({ ...creature, provider: "open5e" }))
      : [];
    const normalizedQuery = normalizeSearchTerm(query);
    const localCreatures = [...state.customCreatures, ...extraMonsters].filter((creature) => (
      normalizeSearchTerm(creature.name).includes(normalizedQuery)
      || normalizeSearchTerm(getLocalizedMonsterName(creature.name)).includes(normalizedQuery)
    ));
    state.initiative.creatures = [...localCreatures, ...officialCreatures, ...open5eCreatures].slice(0, 12);
    renderCreatureSuggestions(state.initiative.creatures);
    status.textContent = state.initiative.creatures.length
      ? t("{count} sugestão(ões) encontradas no SRD 2014 e em fontes abertas.", { count: state.initiative.creatures.length })
      : t("Nenhuma criatura encontrada; você ainda pode adicionar o nome manualmente.");
    if (officialResult.status === "rejected" && open5eResult.status === "rejected" && !state.initiative.creatures.length) {
      status.textContent = t("Busca indisponível. Você ainda pode adicionar o nome manualmente.");
    }
  } catch (error) {
    if (requestId !== state.initiative.requestId) return;
    console.error("Falha ao buscar criaturas para a iniciativa.", error);
    state.initiative.creatures = [];
    renderCreatureSuggestions([]);
    status.textContent = t("Busca indisponível. Você ainda pode adicionar o nome manualmente.");
  }
  listbox.hidden = state.initiative.creatures.length === 0;
}

async function selectInitiativeCreature(creature) {
  const requestId = ++state.initiative.requestId;
  const status = document.querySelector("#creature-search-status");
  status.textContent = t("Carregando ficha de {name}...", { name: creature.name });
  renderCreatureSuggestions([]);
  try {
    const detail = ["open5e", "extra", "custom"].includes(creature.provider)
      ? creature
      : await requestApi(creature.url);
    if (requestId !== state.initiative.requestId) return;
    state.initiative.selectedMonster = { ...detail, provider: creature.provider || "dnd5e" };
    document.querySelector("#combatant-name").value = getLocalizedMonsterName(detail.name);
    document.querySelector("#combatant-hp").value = detail.hit_points ?? "";
    document.querySelector("#combatant-ac").value = getArmorClassValue(detail);
    setMonsterImageButton(
      document.querySelector("#selected-creature-image"),
      getMonsterImageUrl({ ...detail, provider: creature.provider || "dnd5e" }),
      getLocalizedMonsterName(detail.name),
    );
    const source = detail.document__title || "SRD 2014";
    status.textContent = t("Ficha carregada: {name} ({source}). PV e CA preenchidos; ajuste se necessário.", { name: detail.name, source });
  } catch (error) {
    if (requestId !== state.initiative.requestId) return;
    console.error(`Falha ao carregar ficha de ${creature.name}.`, error);
    state.initiative.selectedMonster = null;
    status.textContent = t("Não foi possível carregar a ficha. Os valores podem ser preenchidos manualmente.");
  }
}

function getSafeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function getMonsterImageUrl(monster) {
  const image = monster?.image || monster?.image_url || monster?.img_url;
  if (typeof image !== "string" || !image.trim()) return "";
  try {
    const baseUrl = monster.provider === "dnd5e" && image.startsWith("/")
      ? "https://www.dnd5eapi.co"
      : undefined;
    const url = new URL(image, baseUrl);
    if (url.protocol !== "https:") return "";
    if (monster.provider === "dnd5e" && url.hostname !== "www.dnd5eapi.co") return "";
    return url.href;
  } catch {
    return "";
  }
}

function getMonsterImageCacheKey(monster) {
  return `${monster.provider || "dnd5e"}:${monster.url || monster.slug || monster.name}`;
}

function setMonsterImageButton(button, imageUrl, name) {
  button.hidden = !imageUrl;
  if (!imageUrl) {
    delete button.dataset.imageUrl;
    return;
  }
  button.dataset.imageUrl = imageUrl;
  button.dataset.imageAlt = t("Imagem de {name}", { name });
  button.setAttribute("aria-label", t("Ampliar imagem de {name}", { name }));
  button.title = t("Ampliar imagem de {name}", { name });
}

function showMonsterImage(imageUrl, alt) {
  const image = document.querySelector("#monster-image-preview");
  const status = document.querySelector("#monster-image-status");
  image.src = imageUrl;
  image.alt = alt;
  status.textContent = "";
  document.querySelector("#monster-image-dialog").showModal();
}

async function loadVisibleMonsterImages(requestId) {
  const visibleMonsters = state.monsters.results.slice(0, state.monsters.visibleCount);
  await Promise.all(visibleMonsters.map(async (monster) => {
    const cacheKey = getMonsterImageCacheKey(monster);
    if (state.monsters.imageCache.has(cacheKey) || getMonsterImageUrl(monster)) return;
    if (monster.provider !== "dnd5e" || !monster.url) return;
    try {
      const detail = await requestApi(monster.url);
      state.monsters.imageCache.set(cacheKey, getMonsterImageUrl({ ...detail, provider: "dnd5e" }));
    } catch (error) {
      console.error(`Não foi possível verificar a imagem da criatura ${monster.name}.`, error);
    }
  }));
  if (requestId === state.monsters.requestId) renderMonsters();
}

async function loadOpen5eDocuments() {
  if (state.monsters.documents) return;
  const select = document.querySelector("#monster-document");
  select.disabled = true;
  try {
    const data = await requestExternalJson(`${OPEN5E_BASE}/documents/?limit=100`, "api.open5e.com");
    state.monsters.documents = data.results;
    select.innerHTML = `<option value="">${t("Todas as fontes abertas")}</option>${data.results
      .map((source) => `<option value="${escapeHtml(source.slug)}">${escapeHtml(source.title)}</option>`)
      .join("")}`;
  } catch (error) {
    console.error("Falha ao carregar o índice de publicações abertas do Open5e.", error);
    showToast(t("Não foi possível carregar a lista de publicações Open5e."));
  } finally {
    select.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

// Ícone do sprite SVG embutido no index.html (símbolos "i-<nome>").
function icon(name, className = "icon") {
  return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

// Gira o d20 do botão a cada rolagem; reinicia a animação se clicar de novo.
function spinDice(button) {
  const dice = button?.querySelector(".dice-icon");
  if (!dice) return;
  dice.classList.remove("is-rolling");
  void dice.getBoundingClientRect();
  dice.classList.add("is-rolling");
}

function showToast(message, action = null) {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  if (action) {
    const button = document.createElement("button");
    button.className = "toast-action";
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      toast.remove();
      action.onClick();
    });
    toast.append(button);
  }
  region.append(toast);
  window.setTimeout(() => toast.remove(), action ? 7000 : 3200);
}

function navigate(viewName, { updateHistory = true, scroll = true } = {}) {
  if (!labels[viewName]) viewName = "dashboard";
  if (updateHistory && window.location.hash !== `#${viewName}`) {
    window.history.pushState(null, "", `#${viewName}`);
  }
  document.querySelectorAll(".view").forEach((view) => {
    const active = view.id === `view-${viewName}`;
    view.hidden = !active;
    view.classList.toggle("is-visible", active);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelector("#breadcrumb-current").textContent = labels[viewName];
  if (viewName === "dashboard") {
    renderDashboardCampaign();
    renderDashboardCombat();
  }
  if (viewName === "spells" && !state.spells.results.length) loadSpells();
  if (viewName === "tricks" && !state.tricks.results.length) loadTricks();
  if (viewName === "monsters" && !state.monsters.results.length) loadMonsters();
  if (viewName === "rules") renderRules();
  if (viewName === "initiative") renderInitiative();
  if (viewName === "notes") renderNotes();
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatCount(shown, total, singular, plural) {
  return t("{shown} de {total} {noun}", { shown, total, noun: total === 1 ? singular : plural });
}

// Busca por nome original, nome em português ou apelido; aceita trechos do nome.
function spellMatchesQuery(spell, rawQuery) {
  const query = normalizeSearchTerm(rawQuery);
  if (!query) return true;
  const names = [spell.name, ...(spellTranslations[normalizeSearchTerm(spell.name)] || [])].map(normalizeSearchTerm);
  return names.some((name) => name.includes(query) || query.split(/\s+/).every((term) => name.includes(term)));
}

function getSpellCardSubtitle(spell, fallback) {
  const localizedName = getLocalizedName(spell.name, spellTranslations);
  return localizedName !== spell.name ? spell.name : fallback;
}

async function loadSpells() {
  const requestId = ++state.spells.requestId;
  const feedback = document.querySelector("#spell-feedback");
  const count = document.querySelector("#spell-count");
  feedback.textContent = t("Consultando o compêndio...");
  feedback.classList.remove("is-error");
  document.querySelector("#spell-list").innerHTML = "";
  count.textContent = t("Buscando...");
  try {
    if (!state.spells.catalog) {
      const data = await requestApi("/spells");
      state.spells.catalog = data.results;
    }
    if (requestId !== state.spells.requestId) return;
    state.spells.results = state.spells.catalog.filter((spell) => (
      (state.spells.level === "" || String(spell.level) === state.spells.level)
      && spellMatchesQuery(spell, state.spells.query)
    ));
    state.spells.visibleCount = PAGE_SIZE;
    renderSpells();
    count.textContent = formatCount(Math.min(state.spells.visibleCount, state.spells.results.length), state.spells.results.length, t("magia"), t("magias"));
    feedback.textContent = state.spells.results.length ? "" : t("Nenhuma magia encontrada. Tente outro nome ou círculo.");
    document.querySelector("#spell-more").hidden = state.spells.results.length <= state.spells.visibleCount;
  } catch (error) {
    if (requestId !== state.spells.requestId) return;
    console.error("Falha ao carregar magias da D&D 5e API.", error);
    feedback.textContent = t("Não foi possível carregar as magias. Verifique sua conexão e tente novamente.");
    feedback.classList.add("is-error");
    count.textContent = t("Compêndio indisponível");
  }
}

function renderSpells() {
  const list = document.querySelector("#spell-list");
  list.innerHTML = state.spells.results.slice(0, state.spells.visibleCount).map((spell, index) => `
    <button class="resource-card" type="button" data-resource="spells" data-index="${index}">
      <div class="resource-card-top"><h3>${escapeHtml(getLocalizedName(spell.name, spellTranslations))}</h3></div>
      <p>${escapeHtml(getSpellCardSubtitle(spell, spell.level === 0 ? t("Truque · SRD 2014") : t("{level}º círculo · SRD 2014", { level: spell.level })))}</p>
      <div class="resource-meta"><span>${t("Ver círculo, alcance e descrição")}</span>${icon("arrow-right")}</div>
    </button>`).join("");
}

async function loadTricks() {
  const requestId = ++state.tricks.requestId;
  const feedback = document.querySelector("#trick-feedback");
  const count = document.querySelector("#trick-count");
  feedback.textContent = t("Consultando os truques...");
  feedback.classList.remove("is-error");
  document.querySelector("#trick-list").innerHTML = "";
  count.textContent = t("Buscando...");
  try {
    if (!state.tricks.catalog) {
      const data = await requestApi("/spells?level=0");
      state.tricks.catalog = data.results;
    }
    if (requestId !== state.tricks.requestId) return;
    state.tricks.results = state.tricks.catalog.filter((spell) => spellMatchesQuery(spell, state.tricks.query));
    state.tricks.visibleCount = PAGE_SIZE;
    renderTricks();
    count.textContent = formatCount(Math.min(state.tricks.visibleCount, state.tricks.results.length), state.tricks.results.length, t("truque"), t("truques"));
    feedback.textContent = state.tricks.results.length ? "" : t("Nenhum truque encontrado. Tente outro nome.");
    document.querySelector("#trick-more").hidden = state.tricks.results.length <= state.tricks.visibleCount;
  } catch (error) {
    if (requestId !== state.tricks.requestId) return;
    console.error("Falha ao carregar truques da D&D 5e API.", error);
    feedback.textContent = t("Não foi possível carregar os truques. Verifique sua conexão e tente novamente.");
    feedback.classList.add("is-error");
    count.textContent = t("Compêndio indisponível");
  }
}

function renderTricks() {
  document.querySelector("#trick-list").innerHTML = state.tricks.results
    .slice(0, state.tricks.visibleCount)
    .map((spell, index) => `
      <button class="resource-card" type="button" data-resource="tricks" data-index="${index}">
        <div class="resource-card-top"><h3>${escapeHtml(getLocalizedName(spell.name, spellTranslations))}</h3></div>
        <p>${escapeHtml(getSpellCardSubtitle(spell, t("Truque · SRD 2014")))}</p>
        <div class="resource-meta"><span>${t("Ver alcance, duração e descrição")}</span>${icon("arrow-right")}</div>
      </button>`).join("");
}

function filterLocalCreatures(creatures) {
  const query = normalizeSearchTerm(state.monsters.query);
  return creatures.filter((creature) => (
    !query
    || normalizeSearchTerm(creature.name).includes(query)
    || normalizeSearchTerm(getLocalizedMonsterName(creature.name)).includes(query)
  ));
}

async function getSrdMonsterMatches() {
  if (!state.monsters.nameIndex) state.monsters.nameIndex = (await requestApi("/monsters")).results;
  const query = normalizeSearchTerm(state.monsters.query);
  const resolvedQuery = normalizeSearchTerm(getMonsterSearchName(state.monsters.query));
  const matchingMonsters = query
    ? state.monsters.nameIndex.filter((monster) => (
      normalizeSearchTerm(monster.name).includes(query)
      || normalizeSearchTerm(getLocalizedMonsterName(monster.name)).includes(query)
      || normalizeSearchTerm(monster.name).includes(resolvedQuery)
    ))
    : state.monsters.nameIndex;
  return matchingMonsters.map((monster) => ({ ...monster, provider: "dnd5e" }));
}

// Em "Todas", o Open5e deixa de fora a cópia dele do SRD, que já vem da D&D 5e API.
async function getOpen5eMonsterPage(url) {
  if (!url) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (state.monsters.query) params.set("name__icontains", getMonsterSearchName(state.monsters.query));
    if (state.monsters.provider === "all") params.set("document__slug__not_in", "wotc-srd");
    else if (state.monsters.documentSlug) params.set("document__slug", state.monsters.documentSlug);
    url = `${OPEN5E_BASE}/monsters/?${params}`;
  }
  const data = await requestExternalJson(url, "api.open5e.com");
  return { ...data, results: data.results.map((monster) => ({ ...monster, provider: "open5e" })) };
}

async function loadMonsters({ append = false } = {}) {
  const requestId = ++state.monsters.requestId;
  const feedback = document.querySelector("#monster-feedback");
  const count = document.querySelector("#monster-count");
  feedback.textContent = t("Consultando o bestiário...");
  feedback.classList.remove("is-error");
  if (!append) {
    document.querySelector("#monster-list").innerHTML = "";
    count.textContent = t("Buscando...");
  }
  document.querySelector("#monster-source-label").textContent = {
    all: t("Todas as fontes · SRD, Open5e, outros livros e as suas"),
    open5e: t("Open5e · conteúdo de fontes abertas"),
    extra: t("Outros livros · criaturas embutidas no HUB"),
    custom: t("Minhas criaturas · salvas neste navegador"),
  }[state.monsters.provider] || t("D&D 5e API · regras de 2014");
  try {
    if (state.monsters.provider === "all") {
      if (append) {
        const page = await getOpen5eMonsterPage(state.monsters.next);
        if (requestId !== state.monsters.requestId) return;
        state.monsters.results = [...state.monsters.results, ...page.results];
        state.monsters.next = page.next;
      } else {
        // Uma API fora do ar não esconde as outras fontes.
        const [srd, open5e] = await Promise.allSettled([getSrdMonsterMatches(), getOpen5eMonsterPage()]);
        if (requestId !== state.monsters.requestId) return;
        if (srd.status === "rejected") console.error("Falha ao carregar criaturas da D&D 5e API.", srd.reason);
        if (open5e.status === "rejected") console.error("Falha ao carregar criaturas do Open5e.", open5e.reason);
        const local = filterLocalCreatures([...state.customCreatures, ...extraMonsters]);
        const srdResults = srd.status === "fulfilled" ? srd.value : [];
        const open5ePage = open5e.status === "fulfilled" ? open5e.value : { results: [], next: null, count: 0 };
        state.monsters.results = [...local, ...srdResults, ...open5ePage.results];
        state.monsters.next = open5ePage.next;
        state.monsters.total = local.length + srdResults.length + open5ePage.count;
        state.monsters.visibleCount = PAGE_SIZE;
        if (srd.status === "rejected" || open5e.status === "rejected") {
          showToast(t("Parte do bestiário não respondeu; mostrando as fontes disponíveis."));
        }
      }
    } else if (state.monsters.provider === "open5e") {
      const page = await getOpen5eMonsterPage(append ? state.monsters.next : null);
      if (requestId !== state.monsters.requestId) return;
      state.monsters.results = append ? [...state.monsters.results, ...page.results] : page.results;
      state.monsters.next = page.next;
      state.monsters.total = page.count;
      state.monsters.visibleCount = state.monsters.results.length;
    } else if (["extra", "custom"].includes(state.monsters.provider)) {
      state.monsters.results = filterLocalCreatures(state.monsters.provider === "extra" ? extraMonsters : state.customCreatures);
      state.monsters.next = null;
      state.monsters.total = state.monsters.results.length;
      state.monsters.visibleCount = PAGE_SIZE;
    } else {
      const results = await getSrdMonsterMatches();
      if (requestId !== state.monsters.requestId) return;
      state.monsters.results = results;
      state.monsters.next = null;
      state.monsters.total = results.length;
      state.monsters.visibleCount = PAGE_SIZE;
    }
    renderMonsters();
    loadVisibleMonsterImages(requestId);
    count.textContent = formatCount(Math.min(state.monsters.visibleCount, state.monsters.total), state.monsters.total, t("criatura"), t("criaturas"));
    feedback.textContent = state.monsters.results.length ? "" : (
      state.monsters.provider === "custom" && !state.customCreatures.length
        ? t("Nenhuma criatura importada ainda. Use “Importar criaturas (JSON)”.")
        : t("Nenhuma criatura encontrada. Tente outro nome ou publicação.")
    );
    document.querySelector("#monster-more").hidden = !state.monsters.next
      && state.monsters.results.length <= state.monsters.visibleCount;
  } catch (error) {
    if (requestId !== state.monsters.requestId) return;
    console.error(
      state.monsters.provider === "open5e"
        ? "Falha ao carregar criaturas do Open5e."
        : "Falha ao carregar criaturas da D&D 5e API.",
      error,
    );
    feedback.textContent = t("Não foi possível carregar as criaturas. Verifique sua conexão e tente novamente.");
    feedback.classList.add("is-error");
    count.textContent = t("Bestiário indisponível");
  }
}

function renderMonsters() {
  document.querySelector("#monster-list").innerHTML = state.monsters.results.slice(0, state.monsters.visibleCount).map((monster, index) => {
    const name = getLocalizedMonsterName(monster.name);
    const imageUrl = getMonsterImageUrl(monster) || state.monsters.imageCache.get(getMonsterImageCacheKey(monster)) || "";
    return `
    <article class="resource-card">
      <div class="resource-card-top">
        <button class="resource-card-open monster-card-name" type="button" data-resource="monsters" data-index="${index}"><h3>${escapeHtml(name)}</h3></button>
        <button class="monster-image-button" type="button" data-image-preview data-image-url="${escapeHtml(imageUrl)}" data-image-alt="${escapeHtml(t("Imagem de {name}", { name }))}" aria-label="${escapeHtml(t("Ampliar imagem de {name}", { name }))}" title="${t("Ampliar imagem")}" ${imageUrl ? "" : "hidden"}>▧</button>
      </div>
      <button class="resource-card-details" type="button" data-resource="monsters" data-index="${index}">
        <p>${name !== monster.name ? `${escapeHtml(monster.name)} · ` : ""}${escapeHtml(monster.document__title || "SRD 2014")}</p>
        <span class="resource-meta"><span>${escapeHtml(monster.type ? getLocalizedMonsterType(monster.type) : t("Ver ficha e estatísticas"))}</span>${icon("arrow-right")}</span>
      </button>
    </article>`;
  }).join("");
}

// Converte o markdown simples das descrições do SRD (tabelas, listas, títulos e negrito) em HTML seguro.
function renderSpellText(paragraphs) {
  const inline = (text) => escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
  const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  const html = [];
  let index = 0;
  const lines = paragraphs.filter((line) => line.trim());
  while (index < lines.length) {
    const line = lines[index].trim();
    if (line.startsWith("|")) {
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) rows.push(lines[index++]);
      const [header, ...rest] = rows;
      const body = rest.filter((row) => !/^\|?[\s:|-]+\|?$/.test(row.trim()));
      html.push(`<div class="detail-table-wrap"><table class="detail-table"><thead><tr>${cells(header).map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${cells(row).map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    } else if (line.startsWith("- ")) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) items.push(lines[index++].trim().slice(2));
      html.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    } else if (line.startsWith("#")) {
      html.push(`<h4>${inline(line.replace(/^#+\s*/, ""))}</h4>`);
      index += 1;
    } else {
      html.push(`<p>${inline(line)}</p>`);
      index += 1;
    }
  }
  return html.join("");
}

function renderSpellDetails(detail) {
  const translation = getSpellTranslation(detail.name);
  const components = (detail.components || []).map((component) => ({
    V: t("Verbal"),
    S: t("Somático"),
    M: t("Material"),
  })[component] || component);
  const school = spellSchoolTranslations[normalizeSearchTerm(detail.school?.name)] || detail.school?.name;
  document.querySelector("#detail-chips").innerHTML = [
    translation ? t("Nome original: {name}", { name: detail.name }) : "",
    detail.level === 0 ? t("Truque") : t("{level}º círculo", { level: detail.level }),
    school ? t("Escola: {school}", { school }) : "",
    t("Conjuração: {value}", { value: localizeSpellValue(detail.casting_time) }),
    t("Alcance: {value}", { value: localizeSpellValue(detail.range) }),
    t("Duração: {value}", { value: localizeSpellValue(detail.duration) }),
    components.length ? t("Componentes: {value}", { value: components.join(", ") }) : "",
    detail.concentration ? t("Concentração") : "",
    detail.ritual ? t("Ritual") : "",
    detail.classes?.length
      ? t("Classes: {value}", { value: detail.classes.map((spellClass) => spellClassTranslations[normalizeSearchTerm(spellClass.name)] || spellClass.name).join(", ") })
      : "",
  ].filter(Boolean).map((chip) => `<span class="detail-chip">${escapeHtml(chip)}</span>`).join("");
  const description = translation?.desc || detail.desc || [];
  const higherLevel = translation ? translation.higherLevel || [] : detail.higher_level || [];
  const materialText = translation?.material || detail.material;
  const material = materialText ? `<p><strong>${t("Material")}:</strong> ${escapeHtml(materialText)}</p>` : "";
  const notice = LANG !== "en" && !translation
    ? `<p class="is-error">${t("A tradução desta magia ainda não está disponível; o texto original da API é exibido abaixo.")}</p>`
    : "";
  return `${notice}${renderSpellText(description)}${material}${higherLevel.length ? `<h3>${t("Em círculos superiores")}</h3>${renderSpellText(higherLevel)}` : ""}`;
}

async function showResourceDetails(category, index, resourceOverride = null) {
  const resource = resourceOverride || state[category].results[index];
  if (!resource) return;
  const dialog = document.querySelector("#detail-dialog");
  const body = document.querySelector("#detail-body");
  const isSpell = category === "spells" || category === "tricks";
  document.querySelector("#detail-kicker").textContent = isSpell
    ? `${resource.level === 0 || category === "tricks" ? t("TRUQUE") : t("MAGIA")} · D&D 5E 2014`
    : t("CRIATURA · D&D 5E 2014");
  document.querySelector("#detail-title").textContent = isSpell
    ? getLocalizedName(resource.name, spellTranslations)
    : getLocalizedMonsterName(resource.name);
  const detailImageButton = document.querySelector("#detail-image-button");
  setMonsterImageButton(detailImageButton, "", "");
  document.querySelector("#detail-chips").innerHTML = "";
  body.textContent = t("Carregando detalhes...");
  dialog.showModal();
  try {
    const detail = category === "monsters" && ["open5e", "extra", "custom"].includes(resource.provider)
      ? resource
      : await requestApi(resource.url);
    let imageMarkup = "";
    if (category === "monsters") {
      const monsterDetail = { ...detail, provider: resource.provider || "dnd5e" };
      const imageUrl = getMonsterImageUrl(monsterDetail);
      const name = getLocalizedMonsterName(detail.name);
      state.monsters.imageCache.set(getMonsterImageCacheKey(resource), imageUrl);
      setMonsterImageButton(detailImageButton, imageUrl, name);
      imageMarkup = imageUrl
        ? `<button class="detail-monster-image" type="button" data-image-preview data-image-url="${escapeHtml(imageUrl)}" data-image-alt="${escapeHtml(t("Imagem de {name}", { name }))}" aria-label="${escapeHtml(t("Ampliar imagem de {name}", { name }))}"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" /><span>${t("Ampliar imagem")}</span></button>`
        : "";
    }
    if (isSpell) {
      body.innerHTML = renderSpellDetails(detail);
    } else {
      document.querySelector("#detail-chips").innerHTML = [
        LANG === "en" ? "" : t("Nome original: {name}", { name: detail.name }),
        getMonsterSubtitle(detail),
        `${t("ND")} ${formatChallengeRating(detail.challenge_rating ?? detail.cr)}`,
        detail.document__title,
      ].filter(Boolean).map((chip) => `<span class="detail-chip">${escapeHtml(chip)}</span>`).join("");
      const abilities = ABILITY_LABELS.map(([ability, abbreviation]) => `${abbreviation} ${detail[ability] ?? "—"}`).join(" · ");
      const properties = getMonsterProperties(detail).map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("");
      const actionGroups = getMonsterFeatureGroups(detail)
        .map(([heading, entries]) => `<h3>${heading}</h3>${entries.map(renderMonsterEntry).join("")}`)
        .join("");
      const description = detail.desc ? renderSpellText(translateMonsterText(detail.desc).split("\n")) : "";
      const notes = detail.notes ? renderSpellText(translateMonsterText(detail.notes).split("\n")) : "";
      const sourceUrl = getSafeExternalUrl(detail.document__url);
      const licenseUrl = getSafeExternalUrl(detail.document__license_url);
      const sourceLinks = [
        sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${t("Fonte")} ${icon("arrow-up-right")}</a>` : "",
        licenseUrl ? `<a href="${escapeHtml(licenseUrl)}" target="_blank" rel="noopener noreferrer">${t("Licença")} ${icon("arrow-up-right")}</a>` : "",
      ].filter(Boolean).join(" · ");
      body.innerHTML = `${imageMarkup}${description}<p><strong>${t("Classe de Armadura")}:</strong> ${escapeHtml(localizeArmor(detail))} · <strong>${t("Pontos de Vida")}:</strong> ${escapeHtml(detail.hit_points ?? "—")}${detail.hit_dice ? ` (${escapeHtml(detail.hit_dice)})` : ""}</p><p><strong>${t("Deslocamento")}:</strong> ${escapeHtml(getLocalizedMovement(detail.speed) || "—")}</p><p><strong>${t("Atributos")}:</strong> ${escapeHtml(abilities)}</p>${properties}${actionGroups}${notes}${sourceLinks ? `<p>${sourceLinks}</p>` : ""}`;
    }
    document.querySelector(".dialog-source").textContent = category === "monsters" && detail.document__title
      ? `${t("Fonte:")} ${detail.document__title}${detail.document__license ? ` · ${detail.document__license}` : ""}`
      : LANG !== "en" && (isSpell ? getSpellTranslation(detail.name) : detail.desc ? monsterTextPt[String(detail.desc).trim()] : detail.actions?.some((entry) => monsterTextPt[String(entry.desc).trim()]))
        ? t("Dados da API D&D 5e · 2014 · tradução própria para português")
        : t("Dados de referência da API D&D 5e · 2014");
  } catch (error) {
    console.error(`Falha ao carregar detalhes de ${category}.`, error);
    body.textContent = t("Não foi possível carregar os detalhes. Feche esta janela e tente novamente.");
  }
}

function setupSearch(inputId, category, delay = 350) {
  let timer;
  document.querySelector(inputId).addEventListener("input", (event) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      state[category].query = event.target.value.trim();
      state[category].results = [];
      if (category === "spells") loadSpells();
      else if (category === "tricks") loadTricks();
      else loadMonsters();
    }, delay);
  });
}

// Cada palavra da busca precisa aparecer na regra; resultados com a busca no título vêm primeiro.
function searchRules(rawQuery, category = "") {
  const terms = normalizeSearchTerm(rawQuery).split(/\s+/).filter(Boolean);
  return quickRules
    .filter((rule) => !category || rule.category === category)
    .map((rule) => {
      const title = normalizeSearchTerm(rule.title);
      const text = normalizeSearchTerm(`${rule.title} ${rule.tags} ${rule.summary} ${(rule.points || []).join(" ")}`);
      if (!terms.every((term) => text.includes(term))) return null;
      return { rule, score: terms.filter((term) => title.includes(term)).length };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.rule);
}

function renderRuleBody(rule) {
  return `<p>${escapeHtml(rule.summary)}</p>${rule.points ? `<ul>${rule.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}`;
}

function showRuleDetails(rule) {
  const dialog = document.querySelector("#detail-dialog");
  setMonsterImageButton(document.querySelector("#detail-image-button"), "", "");
  document.querySelector("#detail-kicker").textContent = `${t("REGRA")} · ${ruleCategories[rule.category]}`;
  document.querySelector("#detail-title").textContent = rule.title;
  document.querySelector("#detail-chips").innerHTML = "";
  document.querySelector("#detail-body").innerHTML = renderRuleBody(rule);
  document.querySelector(".dialog-source").textContent = t("Resumo próprio baseado nas regras básicas de 2014");
  if (!dialog.open) dialog.showModal();
}

const SUGGESTED_RULES = ["Concentração", "Ataque de oportunidade", "Cobertura", "Agarrar", "Testes contra a morte"];

function renderInitiativeRuleResults() {
  const query = document.querySelector("#initiative-rule-search").value;
  const results = query.trim()
    ? searchRules(query).slice(0, 6)
    : SUGGESTED_RULES.map((key) => quickRules.find((rule) => rule.key === key)).filter(Boolean);
  const container = document.querySelector("#initiative-rule-results");
  container.innerHTML = results.length
    ? `${query.trim() ? "" : `<small class="rule-results-label">${t("Mais consultadas")}</small>`}${results.map((rule) => `
      <button class="rule-result" type="button" data-rule-key="${escapeHtml(rule.key)}"><span>${escapeHtml(rule.title)}</span><small>${escapeHtml(ruleCategories[rule.category])}</small></button>`).join("")}`
    : `<small class="rule-results-label">${t("Nenhuma regra encontrada.")}</small>`;
}

function renderRules() {
  const filteredRules = searchRules(document.querySelector("#rules-search").value, document.querySelector("#rules-category").value);
  document.querySelector("#rules-list").innerHTML = filteredRules.map((rule) => `
    <article class="rule-card">
      <span class="rule-category">${escapeHtml(ruleCategories[rule.category])}</span>
      <h2>${escapeHtml(rule.title)}</h2>
      ${renderRuleBody(rule)}
    </article>`).join("");
  document.querySelector("#rules-count").textContent = t(filteredRules.length === 1 ? "{count} regra" : "{count} regras", { count: filteredRules.length });
  document.querySelector("#rules-feedback").textContent = filteredRules.length
    ? ""
    : t("Nenhuma regra encontrada. Tente outra palavra.");
}

async function searchInitiativeSpells(query) {
  const requestId = ++state.initiativeSpells.requestId;
  const listbox = document.querySelector("#initiative-spell-suggestions");
  const status = document.querySelector("#initiative-spell-status");
  if (!listbox) return;

  if (normalizeSearchTerm(query).length < 2) {
    state.initiativeSpells.results = [];
    listbox.innerHTML = "";
    listbox.hidden = true;
    document.querySelector("#initiative-spell-search").setAttribute("aria-expanded", "false");
    status.textContent = t("Digite pelo menos 2 letras para buscar magias e truques.");
    return;
  }

  status.textContent = t("Buscando no compêndio...");
  listbox.hidden = true;
  try {
    if (!state.initiativeSpells.catalog) {
      const spellData = await requestApi("/spells");
      state.initiativeSpells.catalog = spellData.results;
    }
    if (requestId !== state.initiativeSpells.requestId) return;

    state.initiativeSpells.results = state.initiativeSpells.catalog
      .filter((spell) => spellMatchesQuery(spell, query))
      .map((spell) => ({ ...spell, category: spell.level === 0 ? "tricks" : "spells" }))
      .slice(0, 12);
    listbox.innerHTML = state.initiativeSpells.results.map((spell, index) => {
      const localizedName = getLocalizedName(spell.name, spellTranslations);
      return `
      <button class="spell-suggestion" type="button" role="option" data-resource="${spell.category}" data-index="${index}">
        <span class="spell-suggestion-copy"><strong>${escapeHtml(localizedName)}</strong>${localizedName !== spell.name ? `<small>${escapeHtml(spell.name)}</small>` : ""}</span>
        <span class="suggestion-level">${spell.level === 0 ? t("Truque") : t("{level}º círculo", { level: spell.level })}</span>
      </button>`;
    }).join("");

    listbox.hidden = state.initiativeSpells.results.length === 0;
    document.querySelector("#initiative-spell-search").setAttribute("aria-expanded", String(!listbox.hidden));
    status.textContent = state.initiativeSpells.results.length
      ? t("{count} resultado(s). Selecione para abrir a ficha.", { count: state.initiativeSpells.results.length })
      : t("Nenhuma magia ou truque encontrado. Tente o nome em português ou inglês.");
  } catch (error) {
    if (requestId !== state.initiativeSpells.requestId) return;
    console.error("Falha ao buscar magias para a iniciativa.", error);
    state.initiativeSpells.results = [];
    listbox.innerHTML = "";
    listbox.hidden = true;
    document.querySelector("#initiative-spell-search").setAttribute("aria-expanded", "false");
    status.textContent = t("Não foi possível consultar o compêndio. Verifique sua conexão e tente novamente.");
  }
}

function getTurnOrder() {
  // Empates na iniciativa são decididos pelo modificador de Destreza.
  return [...state.combatants].sort((a, b) => (
    b.score - a.score
    || (getDexterityModifier(b.monster) ?? 0) - (getDexterityModifier(a.monster) ?? 0)
  ));
}

function getHpStatus(combatant) {
  const hp = Number(combatant.hp);
  if (combatant.hp === "" || combatant.hp == null || !combatant.maxHp) return null;
  const ratio = hp / combatant.maxHp;
  if (hp === 0) return { key: "down", label: combatant.isPlayer ? t("Caído") : t("Abatido"), ratio };
  if (ratio <= 0.25) return { key: "critical", label: t("Crítico"), ratio };
  if (ratio <= 0.5) return { key: "bloodied", label: t("Sangrando"), ratio };
  return { key: "healthy", label: "", ratio };
}

function renderInitiative() {
  const list = document.querySelector("#initiative-list");
  const empty = document.querySelector("#initiative-empty");
  document.querySelector("#round-number").textContent = String(state.round).padStart(2, "0");
  empty.hidden = state.combatants.length > 0;
  const orderedCombatants = getTurnOrder();
  if (!orderedCombatants.some((combatant) => combatant.id === state.currentCombatantId)) {
    state.currentCombatantId = orderedCombatants[0]?.id || null;
  }
  const current = orderedCombatants.find((combatant) => combatant.id === state.currentCombatantId);
  document.querySelector("#current-turn").hidden = !current;
  document.querySelector("#current-turn-name").textContent = current?.name || "";
  document.querySelector("#end-combat").disabled = !state.combatants.length;
  list.innerHTML = orderedCombatants
    .map((combatant, index) => {
      const id = escapeHtml(combatant.id);
      const status = getHpStatus(combatant);
      const tempHp = Number(combatant.tempHp) || 0;
      return `
      <div class="combatant-row ${combatant.id === state.currentCombatantId ? "is-current" : ""} ${combatant.hp === "0" ? "is-down" : ""} ${combatant.isPlayer ? "is-player" : ""}" data-combatant-row="${id}">
        <label class="combatant-score" title="${t("Iniciativa (clique para editar)")}"><span class="turn-index">${t("{n}º", { n: index + 1 })}</span><input class="combatant-score-input" type="number" step="any" min="-10" max="99" value="${escapeHtml(combatant.score)}" data-score-for="${id}" aria-label="${escapeHtml(t("Iniciativa de {name}", { name: combatant.name }))}" /></label>
        <div class="combatant-main">
        <span class="combatant-name-wrap">
          ${combatant.monster
              ? `<span class="combatant-name-with-image"><button class="combatant-name creature-name" type="button" aria-describedby="creature-tip-${id}">${escapeHtml(combatant.name)}</button>${combatant.isPlayer ? `<span class="pc-badge" title="${t("Personagem jogador")}">${t("PJ")}</span>` : ""}${getMonsterImageUrl(combatant.monster) ? `<button class="monster-image-button" type="button" data-image-preview data-image-url="${escapeHtml(getMonsterImageUrl(combatant.monster))}" data-image-alt="${escapeHtml(t("Imagem de {name}", { name: combatant.name }))}" aria-label="${escapeHtml(t("Ampliar imagem de {name}", { name: combatant.name }))}" title="${t("Ampliar imagem")}">${icon("image")}</button>` : ""}</span>${buildMonsterTooltip(combatant.monster, `creature-tip-${id}`)}`
            : `<span class="combatant-name-with-image"><span class="combatant-name">${escapeHtml(combatant.name)}</span>${combatant.isPlayer ? `<span class="pc-badge" title="${t("Personagem jogador")}">${t("PJ")}</span>` : ""}</span>`}
        </span>
        ${renderConditionChips(combatant)}
        </div>
        <span class="combatant-hp-cell">
          <label class="combatant-hp-control"><input class="combatant-hp-input" type="number" min="0" max="${combatant.maxHp || 9999}" value="${escapeHtml(combatant.hp)}" data-hp-for="${id}" aria-label="${escapeHtml(t("Pontos de vida atuais de {name}", { name: combatant.name }))}" /><span>${combatant.maxHp ? `/ ${escapeHtml(combatant.maxHp)}` : ""} ${t("PV")}${tempHp ? ` <b class="temp-hp-tag" title="${t("PV temporários")}">+${tempHp}</b>` : ""}</span></label>
          ${status ? `<span class="hp-bar hp-${status.key}" title="${t("{percent}% dos PV", { percent: Math.round(status.ratio * 100) })}"><span style="width: ${Math.round(status.ratio * 100)}%"></span></span>${status.label ? `<small class="hp-status hp-${status.key}">${status.label}</small>` : ""}` : ""}
        </span>
        <span class="combatant-ac" title="${t("Classe de Armadura")}"><small>${t("CA")}</small><b>${combatant.ac === "" || combatant.ac == null ? "—" : escapeHtml(combatant.ac)}</b></span>
        <button class="icon-button remove-combatant" type="button" data-remove="${id}" aria-label="${escapeHtml(t("Remover {name}", { name: combatant.name }))}" title="${t("Remover")}">${icon("x")}</button>
        ${renderCombatantExtras(combatant)}
      </div>`;
    }).join("");
}

function getActiveConditions(combatant) {
  return Array.isArray(combatant.conditions) ? combatant.conditions.filter((key) => conditionDefs[key]) : [];
}

function renderConditionChips(combatant) {
  const id = escapeHtml(combatant.id);
  const chips = getActiveConditions(combatant).map((key) => `<button class="condition-chip ${key === "concentrating" ? "is-concentration" : ""}" type="button" data-condition-remove="${id}" data-condition-key="${key}" title="${escapeHtml(t("{description} (clique para remover)", { description: conditionDefs[key][1] }))}">${escapeHtml(conditionDefs[key][0])} ${icon("x")}</button>`).join("");
  return chips ? `<div class="combatant-conditions">${chips}</div>` : "";
}

function renderCombatantExtras(combatant) {
  const id = escapeHtml(combatant.id);
  const active = getActiveConditions(combatant);
  const options = Object.entries(conditionDefs)
    .filter(([key]) => !active.includes(key))
    .map(([key, [label]]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("");
  return `<div class="combatant-extras">
    <form class="hp-quick" data-hp-quick="${id}"><input class="hp-quick-input" type="text" inputmode="numeric" autocomplete="off" placeholder="${t("−8 ou +5")}" aria-label="${escapeHtml(t("Dano ou cura de {name}", { name: combatant.name }))}" /><button class="mini-button" type="submit" data-hp-mode="damage" title="${t("Causa dano (PV temporários absorvem primeiro)")}">${t("Dano")}</button><button class="mini-button" type="submit" data-hp-mode="heal" title="${t("Cura até o máximo de PV")}">${t("Cura")}</button></form>
    <label class="temp-hp-field" title="${t("PV temporários absorvem dano antes dos PV atuais")}">${t("Temp")} <input class="hp-quick-input temp-hp-input" type="number" min="0" max="999" value="${Number(combatant.tempHp) || ""}" placeholder="0" data-temp-for="${id}" aria-label="${escapeHtml(t("PV temporários de {name}", { name: combatant.name }))}" /></label>
    <button class="mini-button" type="button" data-duplicate="${id}" title="${t("Duplicar combatente")}">${icon("copy")} ${t("Duplicar")}</button>
    <button class="mini-button ${combatant.isPlayer ? "is-on" : ""}" type="button" data-toggle-player="${id}" aria-pressed="${Boolean(combatant.isPlayer)}" title="${t("PJs são mantidos ao encerrar o combate e nunca são pulados")}">${combatant.isPlayer ? `${icon("check")} ${t("PJ")}` : t("Marcar PJ")}</button>
    <select class="condition-add" data-condition-for="${id}" aria-label="${escapeHtml(t("Adicionar condição a {name}", { name: combatant.name }))}"><option value="">+ ${t("Condição")}</option>${options}</select>
  </div>`;
}

function getDexterityModifier(monster) {
  const dexterity = monster?.dexterity;
  if (dexterity === null || dexterity === undefined || !Number.isFinite(Number(dexterity))) return null;
  return Math.floor((Number(dexterity) - 10) / 2);
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function persistCombatants() {
  const saved = saveStored("cronica-combatants", state.combatants);
  try {
    if (state.currentCombatantId) localStorage.setItem("cronica-current-combatant", state.currentCombatantId);
    else localStorage.removeItem("cronica-current-combatant");
    localStorage.setItem("cronica-round", String(state.round));
  } catch (error) {
    console.error("Não foi possível salvar o turno atual.", error);
  }
  return saved;
}

function snapshotInitiative() {
  return JSON.parse(JSON.stringify({ combatants: state.combatants, round: state.round, currentCombatantId: state.currentCombatantId }));
}

function restoreInitiative(snapshot) {
  state.combatants = snapshot.combatants;
  state.round = snapshot.round;
  state.currentCombatantId = snapshot.currentCombatantId;
  persistCombatants();
  renderInitiative();
  showToast(t("Alteração desfeita."));
}

// Atualiza os PV e mantém as condições coerentes: PJ a 0 PV fica inconsciente e perde a concentração.
function setCombatantHp(combatant, next) {
  const wasDown = combatant.hp === "0";
  const conditions = Array.isArray(combatant.conditions) ? combatant.conditions : [];
  combatant.hp = String(next);
  if (next === 0) {
    combatant.conditions = conditions.filter((key) => key !== "concentrating");
    if (combatant.isPlayer && !combatant.conditions.includes("unconscious")) combatant.conditions.push("unconscious");
  } else if (wasDown) {
    combatant.conditions = conditions.filter((key) => key !== "unconscious");
  }
  return conditions.includes("concentrating");
}

function applyQuickHp(combatantId, rawValue, mode = null) {
  const combatant = state.combatants.find((item) => item.id === combatantId);
  const match = String(rawValue).trim().match(/^([+\-−–]?)\s*(\d{1,4})$/);
  if (!combatant || !match) {
    showToast(t("Use um número, por exemplo 8 e depois Dano ou Cura (ou −8 / +5)."));
    return;
  }
  if (combatant.hp === "" || combatant.hp == null) {
    showToast(t("Informe os PV atuais deste combatente antes de aplicar dano ou cura."));
    return;
  }
  const amount = Number(match[2]);
  const healing = mode ? mode === "heal" : match[1] === "+";
  const current = Number(combatant.hp);
  if (healing) {
    const next = Math.min(combatant.maxHp || 9999, current + amount);
    setCombatantHp(combatant, next);
    persistCombatants();
    renderInitiative();
    showToast(t("{name}: +{amount} → {hp} PV.", { name: combatant.name, amount, hp: next }));
    return;
  }
  const tempHp = Number(combatant.tempHp) || 0;
  const absorbed = Math.min(tempHp, amount);
  combatant.tempHp = tempHp - absorbed;
  const next = Math.max(0, current - (amount - absorbed));
  const wasConcentrating = setCombatantHp(combatant, next);
  persistCombatants();
  renderInitiative();
  const parts = [t("{name}: −{amount} → {hp} PV", { name: combatant.name, amount, hp: next })];
  if (absorbed) parts.push(t("{count} absorvido(s) pelos PV temporários", { count: absorbed }));
  if (next === 0) parts.push(combatant.isPlayer ? t("caído e inconsciente") : t("abatido"));
  if (wasConcentrating && next === 0) parts.push(t("concentração perdida"));
  else if (wasConcentrating && amount > 0) parts.push(t("teste de concentração: CON CD {dc}", { dc: Math.max(10, Math.floor(amount / 2)) }));
  showToast(`${parts.join(" · ")}.`);
}

function getNextCopyNumber(base) {
  const numbers = state.combatants
    .filter((item) => item.name.replace(/\s+\d+$/, "") === base)
    .map((item) => Number(item.name.slice(base.length).trim()) || 1);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

function duplicateCombatant(combatantId) {
  const source = state.combatants.find((item) => item.id === combatantId);
  if (!source) return;
  const base = source.name.replace(/\s+\d+$/, "");
  const modifier = getDexterityModifier(source.monster);
  const score = modifier === null ? source.score : rollD20() + modifier;
  state.combatants.push({
    ...source,
    id: crypto.randomUUID(),
    name: `${base} ${getNextCopyNumber(base)}`,
    score,
    hp: source.maxHp != null ? String(source.maxHp) : source.hp,
    tempHp: 0,
    conditions: [],
  });
  persistCombatants();
  renderInitiative();
  showToast(t(modifier === null ? "{name} duplicado." : "{name} duplicado com nova rolagem de iniciativa.", { name: base }));
}

function rollAllMonsterInitiative() {
  const monsters = state.combatants.filter((item) => !item.isPlayer && getDexterityModifier(item.monster) !== null);
  if (!monsters.length) {
    showToast(t("Nenhum combatente com ficha de criatura para rolar."));
    return;
  }
  monsters.forEach((item) => {
    item.score = rollD20() + getDexterityModifier(item.monster);
  });
  state.currentCombatantId = getTurnOrder()[0].id;
  persistCombatants();
  renderInitiative();
  showToast(t(monsters.length === 1 ? "Iniciativa rolada para {count} criatura." : "Iniciativa rolada para {count} criaturas.", { count: monsters.length }));
}

function toggleCondition(combatantId, key, enable) {
  const combatant = state.combatants.find((item) => item.id === combatantId);
  if (!combatant || !conditionDefs[key]) return;
  const current = Array.isArray(combatant.conditions) ? combatant.conditions : [];
  combatant.conditions = enable ? [...new Set([...current, key])] : current.filter((item) => item !== key);
  persistCombatants();
  renderInitiative();
}

// Avança ou volta o turno; criaturas abatidas (não PJs) são puladas.
function stepTurn(direction) {
  const order = getTurnOrder();
  if (!order.length) {
    showToast(t("Adicione combatentes antes de avançar o turno."));
    return;
  }
  const isSkippable = (combatant) => !combatant.isPlayer && combatant.hp === "0";
  const canSkip = order.some((combatant) => !isSkippable(combatant));
  let index = Math.max(0, order.findIndex((combatant) => combatant.id === state.currentCombatantId));
  let round = state.round;
  let steps = 0;
  do {
    if (direction > 0) {
      index += 1;
      if (index >= order.length) {
        index = 0;
        round += 1;
      }
    } else {
      if (index === 0) {
        if (round === 1) {
          showToast(t("Este já é o primeiro turno do combate."));
          return;
        }
        index = order.length;
        round -= 1;
      }
      index -= 1;
    }
    steps += 1;
  } while (canSkip && isSkippable(order[index]) && steps < order.length);
  state.round = round;
  state.currentCombatantId = order[index].id;
  persistCombatants();
  renderInitiative();
  document.querySelector("#initiative-list .is-current")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function removeCombatant(combatantId) {
  const combatant = state.combatants.find((item) => item.id === combatantId);
  if (!combatant) return;
  const snapshot = snapshotInitiative();
  if (state.currentCombatantId === combatantId) {
    // O turno passa para o próximo da ordem, e não volta ao topo.
    const order = getTurnOrder();
    const index = order.findIndex((item) => item.id === combatantId);
    state.currentCombatantId = order.length > 1 ? order[(index + 1) % order.length].id : null;
  }
  state.combatants = state.combatants.filter((item) => item.id !== combatantId);
  persistCombatants();
  renderInitiative();
  showToast(t("{name} removido.", { name: combatant.name }), { label: t("Desfazer"), onClick: () => restoreInitiative(snapshot) });
}

function endCombat() {
  if (!state.combatants.length) return;
  const players = state.combatants.filter((item) => item.isPlayer);
  const removed = state.combatants.length - players.length;
  const message = players.length
    ? t("Encerrar o combate? {removed} criatura(s) serão removidas e {players} PJ(s) mantidos.", { removed, players: players.length })
    : t("Encerrar o combate? Todos os combatentes serão removidos (nenhum está marcado como PJ).");
  if (!window.confirm(message)) return;
  const snapshot = snapshotInitiative();
  state.combatants = players.map((item) => ({
    ...item,
    tempHp: 0,
    conditions: (item.conditions || []).filter((key) => key === "unconscious" && item.hp === "0"),
  }));
  state.round = 1;
  state.currentCombatantId = getTurnOrder()[0]?.id || null;
  persistCombatants();
  renderInitiative();
  showToast(t("Combate encerrado."), { label: t("Desfazer"), onClick: () => restoreInitiative(snapshot) });
}

function campaignOptions(selected, extra = []) {
  return [...extra, ...state.campaigns.map((campaign) => [campaign.id, campaign.name])]
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function getVisibleNotes() {
  const filter = state.notesFilter;
  return state.notes
    .filter((note) => filter === "all" || (filter === "none" ? !note.campaignId : note.campaignId === filter))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderNotes() {
  const knownCampaigns = new Set(state.campaigns.map((campaign) => campaign.id));
  if (!["all", "none"].includes(state.notesFilter) && !knownCampaigns.has(state.notesFilter)) state.notesFilter = "all";
  document.querySelector("#notes-campaign-filter").innerHTML = campaignOptions(state.notesFilter, [["all", t("Todas as anotações")], ["none", t("Sem campanha")]]);
  const visible = getVisibleNotes();
  document.querySelector("#notes-list").innerHTML = visible.map((note) => {
    const campaign = state.campaigns.find((item) => item.id === note.campaignId);
    return `<button class="note-item ${note.id === state.activeNoteId ? "is-active" : ""}" type="button" data-note-id="${escapeHtml(note.id)}"><strong>${escapeHtml(note.title || t("Sem título"))}</strong><small>${escapeHtml(campaign?.name || t("Sem campanha"))}</small></button>`;
  }).join("");
  document.querySelector("#notes-empty").hidden = visible.length > 0;
  renderNoteEditor();
}

function renderNoteEditor() {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  const defaultCampaign = !["all", "none"].includes(state.notesFilter) ? state.notesFilter : "";
  document.querySelector("#notes-title").value = note?.title || "";
  document.querySelector("#notes-content").value = note?.content || "";
  document.querySelector("#notes-campaign").innerHTML = campaignOptions(note ? note.campaignId : defaultCampaign, [["", t("Sem campanha")]]);
  document.querySelector("#delete-note").hidden = !note;
  document.querySelector("#notes-status").textContent = note ? t("Salvo neste navegador") : t("Nova anotação");
  state.notesDirty = false;
}

function selectNote(noteId) {
  if (state.notesDirty && !window.confirm(t("Descartar as alterações não salvas desta anotação?"))) return;
  state.activeNoteId = noteId;
  renderNotes();
}

function saveCurrentNote() {
  const title = document.querySelector("#notes-title").value.trim();
  const content = document.querySelector("#notes-content").value;
  if (!title && !content.trim()) {
    showToast(t("Escreva um título ou algum texto antes de salvar."));
    return;
  }
  const campaignId = document.querySelector("#notes-campaign").value;
  const existing = state.notes.find((item) => item.id === state.activeNoteId);
  const previous = [...state.notes];
  if (existing) Object.assign(existing, { title, content, campaignId, updatedAt: Date.now() });
  else {
    const created = { id: crypto.randomUUID(), title, content, campaignId, updatedAt: Date.now() };
    state.notes.push(created);
    state.activeNoteId = created.id;
  }
  if (saveStored("cronica-notes", state.notes)) {
    state.notesDirty = false;
    renderNotes();
    showToast(t("Anotação salva."));
  } else {
    state.notes = previous;
  }
}

function deleteCurrentNote() {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  if (!note || !window.confirm(t("Excluir a anotação “{title}”?", { title: note.title || t("Sem título") }))) return;
  state.notes = state.notes.filter((item) => item.id !== note.id);
  saveStored("cronica-notes", state.notes);
  state.activeNoteId = null;
  renderNotes();
  showToast(t("Anotação excluída."));
}

const CREATURE_TEMPLATE = [{
  name: "Sentinela de Cinzas",
  size: "Medium",
  type: "construct",
  alignment: "unaligned",
  armor_class: [{ value: 15, type: "natural armor" }],
  hit_points: 45,
  hit_dice: "6d8 + 18",
  speed: { walk: "30 ft." },
  strength: 16, dexterity: 12, constitution: 16, intelligence: 4, wisdom: 10, charisma: 3,
  saving_throws: { CON: "+5" },
  skills: { Perception: "+2" },
  damage_immunities: "poison",
  condition_immunities: "charmed, exhausted, poisoned",
  senses: "darkvision 60 ft., passive Perception 12",
  languages: "entende a língua do criador, mas não fala",
  challenge_rating: "2",
  special_abilities: [{ name: "Forma Imutável", desc: "A sentinela é imune a qualquer magia ou efeito que altere sua forma." }],
  actions: [
    { name: "Ataques Múltiplos", desc: "A sentinela faz dois ataques de pancada." },
    { name: "Pancada", desc: "Ataque corpo a corpo com arma: +5 para atingir, alcance 1,5 m, um alvo. Acerto: 9 (2d6 + 3) de dano contundente." },
  ],
  document__title: "Criatura própria",
}];

const CREATURE_TEXT_FIELDS = ["size", "type", "subtype", "alignment", "hit_dice", "senses", "languages", "damage_vulnerabilities", "damage_resistances", "damage_immunities", "condition_immunities", "desc", "document__title"];
const CREATURE_ENTRY_FIELDS = ["special_abilities", "actions", "bonus_actions", "reactions", "legendary_actions", "lair_actions"];
const CREATURE_ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

function normalizeCustomCreature(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.name !== "string" || !raw.name.trim()) return null;
  const hitPoints = Number(raw.hit_points);
  if (!Number.isFinite(hitPoints) || hitPoints < 0) return null;
  const clean = (value, max = 4000) => String(value ?? "").slice(0, max);
  const creature = { name: clean(raw.name, 100).trim(), hit_points: Math.round(hitPoints), provider: "custom" };
  creature.slug = `custom-${normalizeSearchTerm(creature.name).replace(/[^a-z0-9]+/g, "-")}`;
  CREATURE_TEXT_FIELDS.forEach((field) => {
    if (raw[field] != null && raw[field] !== "") creature[field] = clean(raw[field]);
  });
  CREATURE_ABILITIES.forEach((field) => {
    const value = Number(raw[field]);
    if (Number.isFinite(value) && value >= 1 && value <= 30) creature[field] = Math.round(value);
  });
  if (Array.isArray(raw.armor_class)) {
    creature.armor_class = raw.armor_class
      .map((entry) => ({ value: Number(entry?.value), type: clean(entry?.type, 60) }))
      .filter((entry) => Number.isFinite(entry.value));
  } else if (Number.isFinite(Number(raw.armor_class))) {
    creature.armor_class = [{ value: Number(raw.armor_class), type: "" }];
  }
  const challenge = raw.challenge_rating ?? raw.cr;
  if (challenge != null && challenge !== "") creature.challenge_rating = clean(challenge, 12);
  const speed = typeof raw.speed === "string" ? { walk: raw.speed } : raw.speed;
  if (speed && typeof speed === "object") {
    creature.speed = Object.fromEntries(Object.entries(speed).slice(0, 8).map(([kind, value]) => [clean(kind, 20), clean(value, 30)]));
  }
  ["saving_throws", "skills"].forEach((field) => {
    if (raw[field] && typeof raw[field] === "object" && !Array.isArray(raw[field])) {
      creature[field] = Object.fromEntries(Object.entries(raw[field]).slice(0, 30).map(([key, value]) => [clean(key, 30), clean(value, 12)]));
    }
  });
  CREATURE_ENTRY_FIELDS.forEach((field) => {
    if (Array.isArray(raw[field])) {
      creature[field] = raw[field].slice(0, 60)
        .map((entry) => ({ name: clean(entry?.name, 120), desc: clean(entry?.desc ?? entry?.description, 4000) }))
        .filter((entry) => entry.name || entry.desc);
    }
  });
  return creature;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function readJsonFile(file, maxBytes = 5 * 1024 * 1024) {
  if (file.size > maxBytes) throw new Error(t("O arquivo é grande demais (limite de 5 MB)."));
  return JSON.parse(await file.text());
}

async function importCustomCreatures(file) {
  try {
    const raw = await readJsonFile(file);
    const list = Array.isArray(raw) ? raw : raw?.creatures ?? raw?.monsters;
    if (!Array.isArray(list)) throw new Error("Esperava uma lista de criaturas.");
    const valid = list.map(normalizeCustomCreature).filter(Boolean);
    if (!valid.length) {
      showToast(t("Nenhuma criatura válida no arquivo. Baixe o modelo para ver o formato."));
      return;
    }
    const merged = new Map(state.customCreatures.map((creature) => [creature.slug, creature]));
    valid.forEach((creature) => merged.set(creature.slug, creature));
    const previous = state.customCreatures;
    state.customCreatures = [...merged.values()];
    if (!saveStored("cronica-custom-creatures", state.customCreatures)) {
      state.customCreatures = previous;
      return;
    }
    const skipped = list.length - valid.length;
    showToast(`${t(valid.length === 1 ? "{count} criatura importada" : "{count} criaturas importadas", { count: valid.length })}${skipped ? t("; {count} ignorada(s) por dados inválidos", { count: skipped }) : ""}.`);
    if (["all", "custom"].includes(state.monsters.provider)) loadMonsters();
  } catch (error) {
    console.error("Falha ao importar criaturas.", error);
    showToast(t("Não foi possível ler o arquivo. Confira se é um JSON válido."));
  }
}

const BACKUP_KEYS = {
  campaigns: "cronica-campaigns",
  activeCampaignId: "cronica-active-campaign",
  combatants: "cronica-combatants",
  round: "cronica-round",
  currentCombatantId: "cronica-current-combatant",
  notes: "cronica-notes",
  customCreatures: "cronica-custom-creatures",
};

function exportAllData() {
  downloadJson(`band-d-backup-${new Date().toISOString().slice(0, 10)}.json`, {
    app: "band-d-hub",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      campaigns: state.campaigns,
      activeCampaignId: state.activeCampaignId,
      combatants: state.combatants,
      round: state.round,
      currentCombatantId: state.currentCombatantId,
      notes: state.notes,
      customCreatures: state.customCreatures,
    },
  });
  document.querySelector("#backup-status").textContent = t("Arquivo gerado. Guarde-o em um lugar seguro.");
}

async function importAllData(file) {
  const status = document.querySelector("#backup-status");
  try {
    const raw = await readJsonFile(file, 20 * 1024 * 1024);
    const data = raw?.app === "band-d-hub" ? raw.data : null;
    if (!data || typeof data !== "object") throw new Error("Arquivo de backup inválido.");
    const text = (value, max) => String(value ?? "").slice(0, max);
    const campaigns = (Array.isArray(data.campaigns) ? data.campaigns : [])
      .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        id: text(item.id, 80),
        name: text(item.name, 80),
        description: text(item.description, 500),
        background: ["mountains", "forest", "ruins", "night", "custom"].includes(item.background) ? item.background : "mountains",
        imageUrl: item.background === "custom" && getSafeExternalUrl(item.imageUrl).startsWith("https:") ? getSafeExternalUrl(item.imageUrl) : "",
      }));
    const combatants = (Array.isArray(data.combatants) ? data.combatants : [])
      .filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && Number.isFinite(Number(item.score)))
      .map((item) => ({
        id: text(item.id, 80),
        name: text(item.name, 48),
        score: Number(item.score),
        hp: text(item.hp, 6),
        maxHp: Number.isFinite(Number(item.maxHp)) && item.maxHp !== null ? Number(item.maxHp) : null,
        tempHp: Math.min(999, Math.max(0, Math.floor(Number(item.tempHp)) || 0)),
        ac: text(item.ac, 6),
        isPlayer: item.isPlayer === true,
        conditions: Array.isArray(item.conditions) ? item.conditions.filter((key) => conditionDefs[key]) : [],
        monster: item.monster && typeof item.monster === "object" ? item.monster : null,
      }));
    const notes = (Array.isArray(data.notes) ? data.notes : [])
      .filter((item) => item && typeof item.id === "string")
      .map((item) => ({ id: text(item.id, 80), title: text(item.title, 100), content: text(item.content, 100000), campaignId: text(item.campaignId, 80), updatedAt: Number(item.updatedAt) || Date.now() }));
    const customCreatures = (Array.isArray(data.customCreatures) ? data.customCreatures : []).map(normalizeCustomCreature).filter(Boolean);
    const summary = t("{campaigns} campanha(s), {combatants} combatente(s), {notes} anotação(ões), {creatures} criatura(s)", {
      campaigns: campaigns.length,
      combatants: combatants.length,
      notes: notes.length,
      creatures: customCreatures.length,
    });
    if (!window.confirm(t("Substituir os dados deste navegador por: {summary}?", { summary }))) return;
    saveStoredOrThrow(BACKUP_KEYS.campaigns, campaigns);
    saveStoredOrThrow(BACKUP_KEYS.combatants, combatants);
    saveStoredOrThrow(BACKUP_KEYS.notes, notes);
    saveStoredOrThrow(BACKUP_KEYS.customCreatures, customCreatures);
    localStorage.setItem("cronica-campaigns-migrated", "true");
    localStorage.setItem(BACKUP_KEYS.round, String(Math.max(1, Number(data.round) || 1)));
    [["activeCampaignId", campaigns], ["currentCombatantId", combatants]].forEach(([field, list]) => {
      const value = data[field];
      if (typeof value === "string" && list.some((item) => item.id === value)) localStorage.setItem(BACKUP_KEYS[field], value);
      else localStorage.removeItem(BACKUP_KEYS[field]);
    });
    status.textContent = t("Dados importados. Recarregando...");
    window.setTimeout(() => window.location.reload(), 600);
  } catch (error) {
    console.error("Falha ao importar o backup.", error);
    status.textContent = t("Não foi possível importar: confira se o arquivo é um backup do BanD&D.");
  }
}

function saveStoredOrThrow(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function renderCampaigns() {
  const container = document.querySelector("#campaign-list");
  document.querySelector("#campaign-count").textContent = String(state.campaigns.length);
  container.querySelectorAll("[data-custom-campaign]").forEach((card) => card.remove());
  const insertBefore = container.querySelector("#new-campaign-card");
  state.campaigns.forEach((campaign) => {
    insertBefore.insertAdjacentHTML("beforebegin", `
      <article class="campaign-card" data-custom-campaign="${escapeHtml(campaign.id)}">
        <div class="campaign-cover campaign-cover-${escapeHtml(["mountains", "forest", "ruins", "night"].includes(campaign.background) ? campaign.background : "mountains")}" data-campaign-cover="${escapeHtml(campaign.id)}"><span aria-hidden="true">${icon("d20")}</span><small>${t("CAMPANHA")}</small></div>
        <div class="campaign-card-body"><div class="campaign-title-row"><div><h2>${escapeHtml(campaign.name)}</h2><p>${escapeHtml(campaign.description || t("Uma nova história começa a ser escrita."))}</p></div><button class="icon-button campaign-edit-icon" type="button" data-edit-campaign="${escapeHtml(campaign.id)}" aria-label="${escapeHtml(t("Editar {name}", { name: campaign.name }))}">${icon("more")}</button></div><div class="campaign-card-meta"><span>${icon("clock")} ${t("Campanha pronta para jogar")}</span></div><button class="button button-outline campaign-open" type="button" data-open-campaign="${escapeHtml(campaign.id)}">${t("Abrir campanha")} ${icon("arrow-right")}</button></div>
      </article>`);
    const cover = container.querySelector(`[data-campaign-cover="${CSS.escape(campaign.id)}"]`);
    const imageUrl = getSafeExternalUrl(campaign.imageUrl);
    if (cover && campaign.background === "custom" && imageUrl) cover.style.backgroundImage = `linear-gradient(0deg, #11131bcc, #11131b33), url("${imageUrl}")`;
  });
  renderDashboardCampaign();
}

function getActiveCampaign() {
  return state.campaigns.find((campaign) => campaign.id === state.activeCampaignId)
    || state.campaigns[0]
    || null;
}

function renderDashboardCampaign() {
  const campaign = getActiveCampaign();
  const name = campaign?.name || t("Nenhuma campanha aberta");
  const description = campaign?.description || (campaign
    ? t("Uma nova história começa a ser escrita.")
    : t("Abra ou crie uma campanha para acompanhar seus detalhes aqui."));
  const banner = document.querySelector("#dashboard-campaign-banner");
  const imageUrl = campaign?.background === "custom" ? getSafeExternalUrl(campaign.imageUrl) : "";

  document.querySelector("#dashboard-campaign-name").textContent = name;
  document.querySelector("#dashboard-campaign-description").textContent = description;
  document.querySelector("#dashboard-campaign-meta").innerHTML = campaign
    ? `<span>${icon("clock")} ${t("Campanha ativa")}</span>`
    : `<span>${icon("plus")} ${t("Crie sua primeira campanha")}</span>`;
  document.querySelector("#dashboard-activity-name").textContent = name;
  document.querySelector("#dashboard-activity-description").textContent = campaign
    ? t("Última campanha aberta")
    : t("Escolha uma campanha para continuar.");
  document.querySelector("#dashboard-open-campaign").disabled = !campaign;
  document.querySelectorAll("[data-open-active-campaign]").forEach((button) => {
    button.disabled = !campaign;
  });

  banner.dataset.background = imageUrl ? "custom" : campaign?.background || "mountains";
  banner.style.backgroundImage = imageUrl
    ? `var(--banner-image-overlay), url("${imageUrl}")`
    : "";
  document.querySelector("#dashboard-banner-art").hidden = Boolean(imageUrl);
}

function renderDashboardCombat() {
  const order = getTurnOrder();
  const current = order.find((combatant) => combatant.id === state.currentCombatantId);
  const players = order.filter((combatant) => combatant.isPlayer).length;
  document.querySelector("#dashboard-round").textContent = order.length ? String(state.round) : "—";
  document.querySelector("#dashboard-combat-title").textContent = current
    ? t("Vez de {name}", { name: current.name })
    : t("Nenhum combate em andamento");
  document.querySelector("#dashboard-combat-detail").textContent = order.length
    ? t("{total} combatente(s) · {players} PJ(s) · {creatures} criatura(s)", { total: order.length, players, creatures: order.length - players })
    : t("Adicione combatentes na iniciativa para começar.");
}

function setActiveCampaign(campaign) {
  state.activeCampaignId = campaign?.id || null;
  try {
    if (state.activeCampaignId) localStorage.setItem("cronica-active-campaign", state.activeCampaignId);
    else localStorage.removeItem("cronica-active-campaign");
  } catch (error) {
    console.error("Não foi possível salvar a campanha ativa.", error);
    showToast(t("A campanha foi aberta, mas não foi possível salvar sua seleção neste navegador."));
  }
  renderDashboardCampaign();
}

function openCampaign(campaign) {
  setActiveCampaign(campaign);
  navigate("initiative");
  showToast(t("Campanha “{name}” aberta. A iniciativa está pronta para a sessão.", { name: campaign.name }));
}

function openCampaignEditor(campaign = null) {
  const dialog = document.querySelector("#campaign-editor");
  const form = document.querySelector("#campaign-editor-form");
  form.reset();
  state.editingCampaignId = campaign?.id || null;
  document.querySelector("#campaign-editor-title").textContent = campaign ? t("Editar campanha") : t("Nova campanha");
  document.querySelector("#campaign-name").value = campaign?.name || "";
  document.querySelector("#campaign-description").value = campaign?.description || "";
  document.querySelector("#campaign-background").value = campaign?.background || "mountains";
  document.querySelector("#campaign-image-url").value = campaign?.imageUrl || "";
  document.querySelector("#delete-editing-campaign").hidden = !campaign;
  updateCampaignImageField();
  dialog.showModal();
}

function updateCampaignImageField() {
  const custom = document.querySelector("#campaign-background").value === "custom";
  document.querySelector("#campaign-image-field").hidden = !custom;
  document.querySelector("#campaign-image-url").required = custom;
}

function updateThemeToggle() {
  const isLight = document.documentElement.dataset.theme === "light";
  const button = document.querySelector("#theme-toggle");
  const label = isLight ? t("Usar tema escuro") : t("Usar tema claro");
  button.innerHTML = icon(isLight ? "moon" : "sun");
  button.setAttribute("aria-label", label);
  button.title = label;
  document.querySelector('meta[name="theme-color"]').content = isLight ? "#e6d9c2" : "#101116";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("bandd-theme", theme);
  } catch (error) {
    console.error("Não foi possível salvar o tema escolhido.", error);
  }
  updateThemeToggle();
}

function setupEvents() {
  const languageSelect = document.querySelector("#language-select");
  languageSelect.value = LANG;
  languageSelect.addEventListener("change", () => {
    if (state.notesDirty && !window.confirm(t("Descartar as alterações não salvas desta anotação?"))) {
      languageSelect.value = LANG;
      return;
    }
    setLanguage(languageSelect.value);
  });
  document.querySelector("#theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  });
  updateThemeToggle();
  document.querySelectorAll("[data-view], [data-go]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (element instanceof HTMLAnchorElement) event.preventDefault();
      navigate(element.dataset.view || element.dataset.go);
    });
  });
  window.addEventListener("hashchange", () => {
    const requestedView = window.location.hash.slice(1);
    const viewName = requestedView === "inicio" ? "dashboard" : requestedView;
    navigate(viewName, { updateHistory: false });
    if (!labels[requestedView] || requestedView !== viewName) {
      window.history.replaceState(null, "", `#${labels[viewName] ? viewName : "dashboard"}`);
    }
  });
  document.querySelector("#global-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.currentTarget.value.trim()) {
      const query = event.currentTarget.value.trim();
      navigate("spells");
      document.querySelector("#spell-search").value = query;
      state.spells.query = query;
      state.spells.level = "";
      document.querySelector("#spell-level").value = "";
      state.spells.results = [];
      loadSpells();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      document.querySelector("#global-search").focus();
    }
  });
  setupSearch("#spell-search", "spells");
  setupSearch("#trick-search", "tricks");
  setupSearch("#monster-search", "monsters");
  document.querySelector("#monster-source").addEventListener("change", (event) => {
    state.monsters.provider = event.target.value;
    state.monsters.results = [];
    state.monsters.next = null;
    document.querySelector("#monster-document-filter").hidden = state.monsters.provider !== "open5e";
    document.querySelector("#custom-creature-tools").hidden = state.monsters.provider !== "custom";
    if (state.monsters.provider === "open5e") loadOpen5eDocuments();
    loadMonsters();
  });
  document.querySelector("#monster-document").addEventListener("change", (event) => {
    state.monsters.documentSlug = event.target.value;
    state.monsters.results = [];
    state.monsters.next = null;
    loadMonsters();
  });
  document.querySelector("#rules-search").addEventListener("input", renderRules);
  document.querySelector("#rules-category").addEventListener("change", renderRules);

  const initSpellSearch = document.querySelector("#initiative-spell-search");
  if (initSpellSearch) {
    let spellSearchTimer;
    initSpellSearch.addEventListener("input", (event) => {
      window.clearTimeout(spellSearchTimer);
      spellSearchTimer = window.setTimeout(
        () => searchInitiativeSpells(event.target.value),
        300,
      );
    });
  }

  const initSpellSuggestions = document.querySelector("#initiative-spell-suggestions");
  if (initSpellSuggestions) {
    initSpellSuggestions.addEventListener("click", (event) => {
      const option = event.target.closest("[data-index]");
      if (!option) return;
      const index = Number(option.dataset.index);
      const resource = state.initiativeSpells.results[index];
      if (!resource) return;
      showResourceDetails(resource.category, index, resource);
      initSpellSuggestions.hidden = true;
      initSpellSearch?.setAttribute("aria-expanded", "false");
    });
  }
  initSpellSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      initSpellSuggestions.hidden = true;
      initSpellSearch.setAttribute("aria-expanded", "false");
    }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && !initSpellSuggestions.hidden) {
      const options = [...initSpellSuggestions.querySelectorAll("[data-index]")];
      if (!options.length) return;
      event.preventDefault();
      const currentIndex = options.findIndex((option) => option.getAttribute("aria-selected") === "true");
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + delta + options.length) % options.length;
      options.forEach((option, index) => option.setAttribute("aria-selected", String(index === nextIndex)));
    }
    if (event.key === "Enter" && !initSpellSuggestions.hidden) {
      const selectedResult = initSpellSuggestions.querySelector('[aria-selected="true"]')
        || initSpellSuggestions.querySelector("[data-index]");
      if (!selectedResult) return;
      event.preventDefault();
      selectedResult.click();
    }
  });
  initSpellSearch?.addEventListener("focus", () => {
    if (state.initiativeSpells.results.length) {
      initSpellSuggestions.hidden = false;
      initSpellSearch.setAttribute("aria-expanded", "true");
    }
  });

  let initiativeSearchTimer;
  let activeCreatureSuggestion = -1;
  const creatureNameInput = document.querySelector("#combatant-name");
  const creatureSuggestions = document.querySelector("#creature-suggestions");
  creatureNameInput.addEventListener("input", () => {
    const selected = state.initiative.selectedMonster;
    const currentName = normalizeSearchTerm(creatureNameInput.value);
    if (selected && ![selected.name, getLocalizedMonsterName(selected.name)].some((name) => normalizeSearchTerm(name) === currentName)) {
      state.initiative.selectedMonster = null;
      document.querySelector("#combatant-hp").value = "";
      document.querySelector("#combatant-ac").value = "";
      setMonsterImageButton(document.querySelector("#selected-creature-image"), "", "");
    }
    activeCreatureSuggestion = -1;
    window.clearTimeout(initiativeSearchTimer);
    initiativeSearchTimer = window.setTimeout(
      () => searchInitiativeCreatures(creatureNameInput.value),
      300,
    );
  });
  creatureNameInput.addEventListener("keydown", async (event) => {
    if (creatureSuggestions.hidden || !state.initiative.creatures.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      activeCreatureSuggestion = (activeCreatureSuggestion + offset + state.initiative.creatures.length) % state.initiative.creatures.length;
      creatureSuggestions.querySelectorAll(".creature-suggestion").forEach((option, index) => {
        option.setAttribute("aria-selected", String(index === activeCreatureSuggestion));
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const index = activeCreatureSuggestion < 0 ? 0 : activeCreatureSuggestion;
      await selectInitiativeCreature(state.initiative.creatures[index]);
    } else if (event.key === "Escape") {
      renderCreatureSuggestions([]);
    }
  });
  creatureSuggestions.addEventListener("mousedown", (event) => event.preventDefault());
  creatureSuggestions.addEventListener("click", async (event) => {
    const option = event.target.closest("[data-creature-index]");
    if (!option) return;
    await selectInitiativeCreature(state.initiative.creatures[Number(option.dataset.creatureIndex)]);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".creature-search-field")) renderCreatureSuggestions([]);
    if (!event.target.closest(".quick-spell-search")) {
      const listbox = document.querySelector("#initiative-spell-suggestions");
      if (listbox) {
        listbox.hidden = true;
        document.querySelector("#initiative-spell-search").setAttribute("aria-expanded", "false");
      }
    }
  });
  document.querySelector("#spell-level").addEventListener("change", (event) => {
    state.spells.level = event.target.value;
    state.spells.results = [];
    loadSpells();
  });
  document.querySelector("#spell-more").addEventListener("click", () => {
    state.spells.visibleCount += PAGE_SIZE;
    renderSpells();
    document.querySelector("#spell-count").textContent = formatCount(Math.min(state.spells.visibleCount, state.spells.results.length), state.spells.results.length, t("magia"), t("magias"));
    document.querySelector("#spell-more").hidden = state.spells.results.length <= state.spells.visibleCount;
  });
  document.querySelector("#trick-more").addEventListener("click", () => {
    state.tricks.visibleCount += PAGE_SIZE;
    renderTricks();
    document.querySelector("#trick-count").textContent = formatCount(Math.min(state.tricks.visibleCount, state.tricks.results.length), state.tricks.results.length, t("truque"), t("truques"));
    document.querySelector("#trick-more").hidden = state.tricks.results.length <= state.tricks.visibleCount;
  });
  document.querySelector("#monster-more").addEventListener("click", () => {
    if (state.monsters.provider === "open5e") {
      loadMonsters({ append: true });
      return;
    }
    state.monsters.visibleCount += PAGE_SIZE;
    // Em "Todas", depois das fontes locais e do SRD, cada clique busca mais uma página do Open5e.
    if (state.monsters.visibleCount > state.monsters.results.length && state.monsters.next) {
      loadMonsters({ append: true });
      return;
    }
    renderMonsters();
    loadVisibleMonsterImages(++state.monsters.requestId);
    document.querySelector("#monster-count").textContent = formatCount(Math.min(state.monsters.visibleCount, state.monsters.total), state.monsters.total, t("criatura"), t("criaturas"));
    document.querySelector("#monster-more").hidden = !state.monsters.next && state.monsters.results.length <= state.monsters.visibleCount;
  });
  document.querySelector("#spell-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-resource]");
    if (card) showResourceDetails(card.dataset.resource, Number(card.dataset.index));
  });
  document.querySelector("#trick-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-resource]");
    if (card) showResourceDetails(card.dataset.resource, Number(card.dataset.index));
  });
  document.querySelector("#monster-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-resource]");
    if (card) showResourceDetails(card.dataset.resource, Number(card.dataset.index));
  });
  document.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-image-preview]");
    if (!previewButton || previewButton.hidden) return;
    showMonsterImage(previewButton.dataset.imageUrl, previewButton.dataset.imageAlt || t("Imagem da criatura"));
  });
  document.querySelector(".dialog-close").addEventListener("click", () => document.querySelector("#detail-dialog").close());
  document.querySelector("#monster-image-close").addEventListener("click", () => document.querySelector("#monster-image-dialog").close());
  document.querySelector("#monster-image-preview").addEventListener("error", () => {
    document.querySelector("#monster-image-status").textContent = t("A API informou uma imagem, mas ela não pôde ser carregada.");
  });
  document.querySelector("#monster-image-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.querySelector("#initiative-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name")).trim();
    const rawScore = String(formData.get("score") ?? "").trim();
    const monster = state.initiative.selectedMonster;
    const modifier = getDexterityModifier(monster);
    const quantity = Math.min(20, Math.max(1, Math.floor(Number(formData.get("quantity")) || 1)));
    if (!name) return;
    if (rawScore === "" && modifier === null) {
      showToast(t("Informe a iniciativa ou use o botão do d20 para rolar."));
      document.querySelector("#combatant-score").focus();
      return;
    }
    if (rawScore !== "" && !Number.isFinite(Number(rawScore))) return;
    const hp = String(formData.get("hp") || "");
    // O máximo de PV é o valor informado; sem ele, usa a média da ficha.
    const maxHp = hp !== "" ? Number(hp) : (monster?.hit_points ?? null);
    const base = quantity > 1 ? name.slice(0, 44) : name;
    let number = quantity > 1 ? getNextCopyNumber(base) : 0;
    const added = Array.from({ length: quantity }, () => ({
      id: crypto.randomUUID(),
      name: quantity > 1 ? `${base} ${number++}` : name,
      // Iniciativa em branco: cada cópia rola d20 + DES. Preenchida: vale para o grupo todo.
      score: rawScore === "" ? rollD20() + modifier : Number(rawScore),
      hp: hp !== "" ? hp : (maxHp != null ? String(maxHp) : ""),
      maxHp,
      tempHp: 0,
      ac: String(formData.get("ac") || ""),
      isPlayer: formData.get("isPlayer") === "on",
      conditions: [],
      monster,
    }));
    state.combatants.push(...added);
    if (!state.currentCombatantId) state.currentCombatantId = getTurnOrder()[0].id;
    if (persistCombatants()) {
      if (rawScore === "") {
        const roll = `d20 ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)}`;
        showToast(quantity > 1
          ? t("{count} combatentes adicionados com iniciativa rolada ({roll}).", { count: quantity, roll })
          : t("{name} adicionado com iniciativa rolada ({roll}).", { name, roll }));
      }
      form.reset();
      setMonsterImageButton(document.querySelector("#selected-creature-image"), "", "");
      state.initiative.selectedMonster = null;
      state.initiative.creatures = [];
      renderCreatureSuggestions([]);
      document.querySelector("#creature-search-status").textContent = t("Digite para buscar criaturas do SRD 2014 e Open5e.");
      renderInitiative();
      document.querySelector("#combatant-name").focus();
    }
  });
  document.querySelector("#roll-initiative").addEventListener("click", (event) => {
    spinDice(event.currentTarget);
    const dexterityValue = state.initiative.selectedMonster?.dexterity;
    const hasDexterity = dexterityValue !== null && dexterityValue !== undefined && Number.isFinite(Number(dexterityValue));
    const modifier = hasDexterity ? Math.floor((Number(dexterityValue) - 10) / 2) : 0;
    const roll = rollD20();
    document.querySelector("#combatant-score").value = String(roll + modifier);
    if (hasDexterity) {
      showToast(t("Iniciativa: {roll} no d20 {sign} {modifier} de Destreza.", { roll, sign: modifier >= 0 ? "+" : "−", modifier: Math.abs(modifier) }));
    } else if (state.initiative.selectedMonster) {
      showToast(t("Iniciativa: {roll} no d20. A ficha não informou Destreza para aplicar o modificador.", { roll }));
    } else {
      showToast(t("Iniciativa rolada sem modificador. Selecione uma criatura para somar a Destreza."));
    }
  });
  document.querySelector("#next-turn").addEventListener("click", () => stepTurn(1));
  document.querySelector("#previous-turn").addEventListener("click", () => stepTurn(-1));
  document.querySelector("#end-combat").addEventListener("click", endCombat);
  document.querySelector("#reset-initiative").addEventListener("click", () => {
    state.round = 1;
    state.currentCombatantId = getTurnOrder()[0]?.id || null;
    persistCombatants();
    renderInitiative();
    showToast(t("Rodada reiniciada."));
  });
  document.addEventListener("keydown", (event) => {
    if (document.querySelector("#view-initiative").hidden || event.ctrlKey || event.metaKey || event.altKey) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) || document.querySelector("dialog[open]")) return;
    const key = event.key.toLowerCase();
    if (key === "n" || key === "arrowright") {
      event.preventDefault();
      stepTurn(1);
    } else if (key === "v" || key === "arrowleft") {
      event.preventDefault();
      stepTurn(-1);
    } else if (key === "a") {
      event.preventDefault();
      document.querySelector("#combatant-name").focus();
    } else if (key === "r") {
      event.preventDefault();
      document.querySelector("#rules-lookup").open = true;
      document.querySelector("#initiative-rule-search").focus();
    }
  });
  const rulesLookup = document.querySelector("#rules-lookup");
  rulesLookup.addEventListener("toggle", () => {
    if (!rulesLookup.open) return;
    renderInitiativeRuleResults();
    document.querySelector("#initiative-rule-search").focus();
  });
  document.querySelector("#initiative-rule-search").addEventListener("input", renderInitiativeRuleResults);
  document.querySelector("#initiative-rule-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.querySelector("#initiative-rule-results [data-rule-key]")?.click();
    } else if (event.key === "Escape") {
      rulesLookup.open = false;
    }
  });
  document.querySelector("#initiative-rule-results").addEventListener("click", (event) => {
    const button = event.target.closest("[data-rule-key]");
    const rule = button && quickRules.find((item) => item.key === button.dataset.ruleKey);
    if (rule) showRuleDetails(rule);
  });
  document.querySelector("#save-note").addEventListener("click", saveCurrentNote);
  document.querySelector("#delete-note").addEventListener("click", deleteCurrentNote);
  document.querySelector("#new-note").addEventListener("click", () => selectNote(null));
  document.querySelector("#notes-list").addEventListener("click", (event) => {
    const item = event.target.closest("[data-note-id]");
    if (item && item.dataset.noteId !== state.activeNoteId) selectNote(item.dataset.noteId);
  });
  document.querySelector("#notes-campaign-filter").addEventListener("change", (event) => {
    if (state.notesDirty && !window.confirm(t("Descartar as alterações não salvas desta anotação?"))) {
      event.target.value = state.notesFilter;
      return;
    }
    state.notesFilter = event.target.value;
    state.activeNoteId = null;
    renderNotes();
  });
  document.querySelectorAll("#notes-title, #notes-content, #notes-campaign").forEach((field) => {
    field.addEventListener("input", () => {
      state.notesDirty = true;
      document.querySelector("#notes-status").textContent = t("Alterações não salvas");
    });
  });
  document.querySelector("#export-data").addEventListener("click", exportAllData);
  document.querySelector("#import-data").addEventListener("click", () => document.querySelector("#import-data-file").click());
  document.querySelector("#import-data-file").addEventListener("change", (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) importAllData(file);
  });
  document.querySelector("#import-creatures").addEventListener("click", () => document.querySelector("#creature-import-file").click());
  document.querySelector("#creature-import-file").addEventListener("change", (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) importCustomCreatures(file);
  });
  document.querySelector("#download-creature-template").addEventListener("click", () => downloadJson(t("modelo-criaturas.json"), CREATURE_TEMPLATE));
  document.querySelector("#clear-creatures").addEventListener("click", () => {
    if (!state.customCreatures.length || !window.confirm(t("Remover todas as criaturas importadas deste navegador?"))) return;
    state.customCreatures = [];
    saveStored("cronica-custom-creatures", state.customCreatures);
    if (["all", "custom"].includes(state.monsters.provider)) loadMonsters();
    showToast(t("Criaturas importadas removidas."));
  });
  document.querySelector("#roll-all-initiative").addEventListener("click", (event) => {
    spinDice(event.currentTarget);
    rollAllMonsterInitiative();
  });
  const initiativeList = document.querySelector("#initiative-list");
  initiativeList.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-hp-quick]");
    if (!form) return;
    event.preventDefault();
    // Enter no campo usa o sinal digitado; os botões Dano/Cura definem o modo.
    applyQuickHp(form.dataset.hpQuick, form.querySelector("input").value, event.submitter?.dataset.hpMode || null);
  });
  initiativeList.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) removeCombatant(removeButton.dataset.remove);
    const duplicate = event.target.closest("[data-duplicate]");
    if (duplicate) duplicateCombatant(duplicate.dataset.duplicate);
    const chip = event.target.closest("[data-condition-remove]");
    if (chip) toggleCondition(chip.dataset.conditionRemove, chip.dataset.conditionKey, false);
    const playerToggle = event.target.closest("[data-toggle-player]");
    if (playerToggle) {
      const combatant = state.combatants.find((item) => item.id === playerToggle.dataset.togglePlayer);
      if (!combatant) return;
      combatant.isPlayer = !combatant.isPlayer;
      persistCombatants();
      renderInitiative();
    }
  });
  initiativeList.addEventListener("change", (event) => {
    const select = event.target.closest("[data-condition-for]");
    if (select && select.value) toggleCondition(select.dataset.conditionFor, select.value, true);
    const hpInput = event.target.closest("[data-hp-for]");
    if (hpInput) {
      const combatant = state.combatants.find((item) => item.id === hpInput.dataset.hpFor);
      const hp = Number(hpInput.value);
      if (!combatant || hpInput.value === "" || !Number.isInteger(hp) || hp < 0 || hp > (combatant.maxHp || 9999)) {
        hpInput.value = combatant?.hp ?? "";
        showToast(t("Informe pontos de vida dentro do limite permitido."));
        return;
      }
      setCombatantHp(combatant, hp);
      persistCombatants();
      renderInitiative();
    }
    const scoreInput = event.target.closest("[data-score-for]");
    if (scoreInput) {
      const combatant = state.combatants.find((item) => item.id === scoreInput.dataset.scoreFor);
      const score = Number(scoreInput.value);
      if (!combatant || scoreInput.value === "" || !Number.isFinite(score) || score < -10 || score > 99) {
        scoreInput.value = combatant?.score ?? "";
        showToast(t("Informe uma iniciativa entre −10 e 99."));
        return;
      }
      combatant.score = score;
      persistCombatants();
      renderInitiative();
    }
    const tempInput = event.target.closest("[data-temp-for]");
    if (tempInput) {
      const combatant = state.combatants.find((item) => item.id === tempInput.dataset.tempFor);
      if (!combatant) return;
      // PV temporários não se acumulam: o novo valor substitui o anterior.
      combatant.tempHp = Math.min(999, Math.max(0, Math.floor(Number(tempInput.value)) || 0));
      persistCombatants();
      renderInitiative();
    }
  });
  document.querySelectorAll("#new-campaign, #new-campaign-card").forEach((button) => button.addEventListener("click", () => openCampaignEditor()));
  document.querySelector("#campaign-background").addEventListener("change", updateCampaignImageField);
  document.querySelector("#campaign-editor-close").addEventListener("click", () => document.querySelector("#campaign-editor").close());
  document.querySelector("#cancel-campaign-edit").addEventListener("click", () => document.querySelector("#campaign-editor").close());
  document.querySelector("#campaign-editor").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.querySelectorAll("[data-open-active-campaign]").forEach((button) => {
    button.addEventListener("click", () => {
      const campaign = getActiveCampaign();
      if (campaign) openCampaign(campaign);
      else navigate("campaigns");
    });
  });
  document.querySelector("#campaign-editor-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name")).trim();
    const background = String(formData.get("background"));
    const rawImageUrl = String(formData.get("imageUrl") || "").trim();
    const imageUrl = background === "custom" ? getSafeExternalUrl(rawImageUrl) : "";
    if (background === "custom" && (!imageUrl || new URL(imageUrl).protocol !== "https:")) {
      showToast(t("Informe uma URL de imagem HTTPS válida."));
      return;
    }
    const campaignData = {
      name,
      description: String(formData.get("description") || "").trim(),
      background,
      imageUrl,
    };
    const existingIndex = state.campaigns.findIndex((campaign) => campaign.id === state.editingCampaignId);
    if (existingIndex >= 0) state.campaigns[existingIndex] = { ...state.campaigns[existingIndex], ...campaignData };
    else state.campaigns.push({ id: crypto.randomUUID(), ...campaignData });
    if (saveStored("cronica-campaigns", state.campaigns)) {
      renderCampaigns();
      document.querySelector("#campaign-editor").close();
      showToast(existingIndex >= 0 ? t("Campanha atualizada.") : t("Campanha “{name}” criada.", { name }));
    }
  });
  document.querySelector("#delete-editing-campaign").addEventListener("click", () => {
    const campaign = state.campaigns.find((item) => item.id === state.editingCampaignId);
    if (!campaign || !window.confirm(t("Excluir a campanha “{name}”?", { name: campaign.name }))) return;
    const wasActive = state.activeCampaignId === campaign.id;
    state.campaigns = state.campaigns.filter((item) => item.id !== campaign.id);
    if (saveStored("cronica-campaigns", state.campaigns)) {
      if (state.notes.some((note) => note.campaignId === campaign.id)) {
        state.notes.forEach((note) => { if (note.campaignId === campaign.id) note.campaignId = ""; });
        saveStored("cronica-notes", state.notes);
      }
      if (wasActive) setActiveCampaign(state.campaigns[0] || null);
      renderCampaigns();
      document.querySelector("#campaign-editor").close();
      showToast(t("Campanha excluída."));
    }
  });
  document.querySelector("#campaign-list").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-campaign]");
    if (editButton) {
      const campaign = state.campaigns.find((item) => item.id === editButton.dataset.editCampaign);
      if (campaign) openCampaignEditor(campaign);
      return;
    }
    const campaignButton = event.target.closest("[data-open-campaign]");
    if (campaignButton) {
      const campaign = state.campaigns.find((item) => item.id === campaignButton.dataset.openCampaign);
      if (campaign) openCampaign(campaign);
    }
  });
}

translateStaticPage();
document.querySelector("#today-label").textContent = new Date()
  .toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })
  .toLocaleUpperCase(LOCALE);
setupEvents();
renderInitiative();
renderCampaigns();
const initialRoute = window.location.hash.slice(1);
const initialView = initialRoute === "inicio" ? "dashboard" : initialRoute;
navigate(initialView, { updateHistory: false, scroll: false });
if (!labels[initialRoute] || initialRoute !== initialView) {
  window.history.replaceState(null, "", `#${labels[initialView] ? initialView : "dashboard"}`);
}
