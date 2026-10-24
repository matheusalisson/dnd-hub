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
  spells: { results: [], visibleCount: PAGE_SIZE, query: "", level: "", requestId: 0 },
  tricks: { catalog: null, results: [], visibleCount: PAGE_SIZE, query: "", requestId: 0 },
  monsters: { results: [], visibleCount: PAGE_SIZE, query: "", provider: "dnd5e", documentSlug: "", documents: null, nameIndex: null, next: null, requestId: 0, imageCache: new Map() },
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
  initiativeSpells: { catalog: null, trickNames: null, results: [], requestId: 0 },
};

const spellTranslations = {
  "acid arrow": ["flecha ácida"],
  "acid splash": ["respingo ácido"],
  "aid": ["ajuda"],
  "animal friendship": ["amizade animal"],
  "armor of agathys": ["armadura de agathys"],
  "arms of hadar": ["braços de hadar"],
  "bane": ["perdição"],
  "banishment": ["banimento"],
  "barkskin": ["pele de árvore"],
  "beacon of hope": ["sinal de esperança"],
  "bless": ["bênção"],
  "burning hands": ["mãos flamejantes"],
  "charm person": ["enfeitiçar pessoa"],
  "chill touch": ["toque arrepiante"],
  "chromatic orb": ["orbe cromática"],
  "cure wounds": ["curar ferimentos"],
  "counterspell": ["contramágica"],
  "darkness": ["escuridão"],
  "dancing lights": ["luzes dançantes"],
  "daylight": ["luz do dia"],
  "detect magic": ["detectar magia"],
  "dispel magic": ["dissipar magia"],
  "druidcraft": ["druidismo"],
  "eldritch blast": ["rajada mística"],
  "faerie fire": ["fogo das fadas"],
  "fear": ["medo"],
  "feather fall": ["queda suave"],
  "fire bolt": ["raio de fogo"],
  "fireball": ["bola de fogo"],
  "fly": ["voo"],
  "guiding bolt": ["raio guiador"],
  "guidance": ["orientação"],
  "healing word": ["palavra curativa"],
  "hold person": ["imobilizar pessoa"],
  "invisibility": ["invisibilidade"],
  "light": ["luz"],
  "lightning bolt": ["relâmpago"],
  "lesser restoration": ["restauração menor"],
  "mage armor": ["armadura arcana"],
  "magic missile": ["mísseis mágicos", "míssil mágico"],
  "mage hand": ["mão mágica"],
  "mending": ["reparar"],
  "message": ["mensagem"],
  "minor illusion": ["ilusão menor"],
  "misty step": ["passo nebuloso"],
  "moonbeam": ["raio lunar"],
  "pass without trace": ["passos sem pegadas"],
  "poison spray": ["rajada venenosa"],
  "polymorph": ["metamorfose"],
  "prestidigitation": ["prestidigitação"],
  "produce flame": ["produzir chamas"],
  "ray of frost": ["raio de gelo"],
  "resistance": ["resistência"],
  "revivify": ["revivificar"],
  "sacred flame": ["chama sagrada"],
  "shield": ["escudo"],
  "shocking grasp": ["toque chocante"],
  "shillelagh": ["bordão mágico"],
  "spiritual weapon": ["arma espiritual"],
  "spirit guardians": ["guardiões espirituais"],
  "spare the dying": ["poupar os moribundos"],
  "speak with animals": ["falar com animais"],
  "sleep": ["sono"],
  "slow": ["lentidão"],
  "thaumaturgy": ["taumaturgia"],
  "thunderwave": ["onda trovejante"],
  "true resurrection": ["ressurreição verdadeira"],
  "true strike": ["ataque certeiro"],
  "vicious mockery": ["escárnio vicioso"],
  "wall of fire": ["muralha de fogo"],
  "web": ["teia"],
  "witch bolt": ["raio místico"],
  "wrathful smite": ["golpe colérico"],
};

const trickDescriptions = {
  "acid splash": [
    "Você arremessa uma bolha de ácido. Escolha uma criatura dentro do alcance ou duas criaturas que estejam a até 1,5 metro uma da outra. O alvo deve ser bem-sucedido em um teste de resistência de Destreza ou sofre 1d6 de dano ácido.",
    "O dano desta magia aumenta em 1d6 quando você alcança o 5º nível (2d6), o 11º nível (3d6) e o 17º nível (4d6).",
  ],
  "chill touch": [
    "Você cria uma mão fantasmagórica e esquelética no espaço de uma criatura dentro do alcance. Faça um ataque mágico à distância contra ela, envolvendo-a no frio do túmulo. Se acertar, o alvo sofre 1d8 de dano necrótico e não pode recuperar pontos de vida até o início do seu próximo turno. Até lá, a mão permanece agarrada ao alvo.",
    "Se você acertar um morto-vivo, ele também terá desvantagem nas jogadas de ataque contra você até o fim do seu próximo turno.",
    "O dano desta magia aumenta em 1d8 quando você alcança o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8).",
  ],
  "dancing lights": [
    "Você cria até quatro luzes do tamanho de tochas dentro do alcance, que podem parecer tochas, lanternas ou orbes brilhantes pairando no ar. Também pode combinar as quatro luzes em uma forma vagamente humanoide de tamanho Médio. Em qualquer forma, cada luz emite penumbra em um raio de 3 metros.",
    "Como uma ação bônus no seu turno, você pode mover as luzes até 18 metros para um novo ponto dentro do alcance. Uma luz deve permanecer a até 6 metros de outra luz criada por esta magia; ela se apaga se ultrapassar o alcance da magia.",
  ],
  "druidcraft": [
    "Ao sussurrar para os espíritos da natureza, você cria um dos efeitos a seguir dentro do alcance:",
    "• Você cria um efeito sensorial minúsculo e inofensivo que prevê o clima no local onde está pelas próximas 24 horas. O efeito pode aparecer como um orbe dourado para indicar céu limpo, uma nuvem para chuva, flocos de neve para neve e assim por diante. Ele dura 1 rodada.",
    "• Você faz uma flor desabrochar, uma vagem se abrir ou um botão de folha florescer instantaneamente.",
    "• Você cria um efeito sensorial instantâneo e inofensivo, como folhas caindo, uma brisa, o som de um animal pequeno ou um leve cheiro de gambá. O efeito deve caber em um cubo de 1,5 metro.",
    "• Você acende ou apaga instantaneamente uma vela, tocha ou pequena fogueira.",
  ],
  "eldritch blast": [
    "Um raio de energia crepitante dispara em direção a uma criatura dentro do alcance. Faça um ataque mágico à distância contra o alvo. Se acertar, ele sofre 1d10 de dano energético.",
    "A magia cria mais raios quando você alcança níveis superiores: dois raios no 5º nível, três no 11º nível e quatro no 17º nível. Você pode direcionar os raios ao mesmo alvo ou a alvos diferentes. Faça uma jogada de ataque separada para cada raio.",
  ],
  "fire bolt": [
    "Você arremessa uma fagulha de fogo contra uma criatura ou objeto dentro do alcance. Faça um ataque mágico à distância contra o alvo. Se acertar, ele sofre 1d10 de dano ígneo. Um objeto inflamável atingido por esta magia incendeia-se se não estiver sendo vestido ou carregado.",
    "O dano desta magia aumenta em 1d10 quando você alcança o 5º nível (2d10), o 11º nível (3d10) e o 17º nível (4d10).",
  ],
  "guidance": [
    "Você toca uma criatura voluntária. Antes do fim da magia, o alvo pode rolar 1d4 e adicionar o resultado a um teste de atributo à sua escolha. Ele pode rolar o dado antes ou depois de fazer o teste. Então, a magia termina.",
  ],
  "light": [
    "Você toca um objeto que não seja maior que 3 metros em qualquer dimensão. Até a magia terminar, o objeto emite luz plena em um raio de 6 metros e penumbra por mais 6 metros. Você pode escolher a cor da luz. Cobrir completamente o objeto com algo opaco bloqueia a luz. A magia termina se você a conjurar novamente ou encerrá-la usando uma ação.",
    "Se o objeto escolhido estiver sendo vestido ou carregado por uma criatura hostil, ela deve ser bem-sucedida em um teste de resistência de Destreza para evitar a magia.",
  ],
  "mage hand": [
    "Uma mão espectral e flutuante aparece em um ponto à sua escolha dentro do alcance. Ela dura até o fim da magia ou até você dispensá-la usando uma ação. A mão desaparece se ficar a mais de 9 metros de você ou se você conjurar esta magia novamente.",
    "Você pode usar sua ação para controlar a mão. Ela pode manipular um objeto, abrir uma porta ou recipiente destrancado, guardar ou retirar um item de um recipiente aberto ou despejar o conteúdo de um frasco. A cada uso, você pode mover a mão até 9 metros.",
    "A mão não pode atacar, ativar itens mágicos nem carregar mais de 4,5 quilos.",
  ],
  "mending": [
    "Esta magia repara uma única quebra ou rasgo em um objeto que você tocar, como uma chave quebrada, uma capa rasgada ou um odre furado. Desde que a quebra ou o rasgo não tenha mais de 30 centímetros em qualquer dimensão, você o conserta sem deixar vestígios do dano.",
    "A magia pode reparar fisicamente um item mágico ou construto, mas não restaura a magia desse objeto.",
  ],
  "message": [
    "Você aponta o dedo para uma criatura dentro do alcance e sussurra uma mensagem. Somente o alvo ouve a mensagem e pode responder em um sussurro que apenas você consegue ouvir.",
    "Você pode conjurar esta magia através de objetos sólidos se conhecer o alvo e souber que ele está além da barreira. Silêncio mágico, 30 centímetros de pedra, 2,5 centímetros de metal comum, uma fina folha de chumbo ou 90 centímetros de madeira bloqueiam a magia. Ela não precisa seguir uma linha reta e pode contornar esquinas e passar por aberturas.",
  ],
  "minor illusion": [
    "Você cria um som ou a imagem de um objeto dentro do alcance, que dura até o fim da magia. A ilusão também termina se você a dispensar usando uma ação ou conjurar esta magia novamente.",
    "Se criar um som, o volume pode variar de um sussurro a um grito. Pode ser sua voz, a voz de outra pessoa, o rugido de um leão, uma batida de tambores ou qualquer outro som que você escolher. O som continua sem parar durante toda a duração, ou você pode criar sons distintos em momentos diferentes antes do fim da magia.",
    "Se criar a imagem de um objeto — como uma cadeira, pegadas na lama ou um pequeno baú —, ela não pode ser maior que um cubo de 1,5 metro. A imagem não pode produzir som, luz, cheiro nem qualquer outro efeito sensorial. A interação física revela que ela é uma ilusão, pois objetos atravessam sua imagem.",
    "Se uma criatura usar sua ação para examinar o som ou a imagem, poderá determinar que é uma ilusão se for bem-sucedida em um teste de Inteligência (Investigação) contra a CD das suas magias. Se perceber a ilusão como tal, ela se torna tênue para essa criatura.",
  ],
  "poison spray": [
    "Você estende a mão em direção a uma criatura que possa ver dentro do alcance e projeta da palma um sopro de gás nocivo. A criatura deve ser bem-sucedida em um teste de resistência de Constituição ou sofre 1d12 de dano venenoso.",
    "O dano desta magia aumenta em 1d12 quando você alcança o 5º nível (2d12), o 11º nível (3d12) e o 17º nível (4d12).",
  ],
  "prestidigitation": [
    "Esta magia é um pequeno truque mágico usado por conjuradores iniciantes para praticar. Você cria um dos seguintes efeitos mágicos dentro do alcance:",
    "• Você cria um efeito sensorial instantâneo e inofensivo, como uma chuva de faíscas, uma brisa, notas musicais suaves ou um odor peculiar.",
    "• Você acende ou apaga instantaneamente uma vela, tocha ou pequena fogueira.",
    "• Você limpa ou suja instantaneamente um objeto que não seja maior que 28 litros.",
    "• Você resfria, aquece ou dá sabor a até 28 litros de material inanimado por 1 hora.",
    "• Você faz uma cor, pequena marca ou símbolo aparecer em um objeto ou superfície por 1 hora.",
    "• Você cria uma bugiganga não mágica ou uma imagem ilusória que caiba na sua mão e dure até o fim do seu próximo turno.",
    "Se conjurar esta magia várias vezes, pode manter até três de seus efeitos não instantâneos ativos ao mesmo tempo. Você pode dispensar esses efeitos usando uma ação.",
  ],
  "produce flame": [
    "Uma chama bruxuleante aparece na sua mão. Ela permanece ali durante a magia e não causa dano a você nem ao seu equipamento. A chama emite luz plena em um raio de 3 metros e penumbra por mais 3 metros. A magia termina se você dispensar a chama usando uma ação ou conjurar esta magia novamente.",
    "Você também pode atacar com a chama, mas isso encerra a magia. Ao conjurá-la ou usando uma ação em um turno posterior, você pode arremessar a chama contra uma criatura a até 9 metros de você. Faça um ataque mágico à distância. Se acertar, o alvo sofre 1d8 de dano ígneo.",
    "O dano desta magia aumenta em 1d8 quando você alcança o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8).",
  ],
  "ray of frost": [
    "Um raio gélido de luz azul-esbranquiçada dispara em direção a uma criatura dentro do alcance. Faça um ataque mágico à distância contra o alvo. Se acertar, ele sofre 1d8 de dano gélido e seu deslocamento é reduzido em 3 metros até o início do seu próximo turno.",
    "O dano desta magia aumenta em 1d8 quando você alcança o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8).",
  ],
  "resistance": [
    "Você toca uma criatura voluntária. Antes do fim da magia, o alvo pode rolar 1d4 e adicionar o resultado a um teste de resistência à sua escolha. Ele pode rolar o dado antes ou depois de fazer o teste. Então, a magia termina.",
  ],
  "sacred flame": [
    "Uma radiância semelhante a uma chama desce sobre uma criatura que você possa ver dentro do alcance. O alvo deve ser bem-sucedido em um teste de resistência de Destreza ou sofre 1d8 de dano radiante. O alvo não recebe benefício de cobertura contra esse teste de resistência.",
    "O dano desta magia aumenta em 1d8 quando você alcança o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8).",
  ],
  "shillelagh": [
    "A madeira de uma clava ou bordão que você esteja segurando é imbuída do poder da natureza. Durante a magia, você pode usar seu atributo de conjuração em vez de Força nas jogadas de ataque e dano de ataques corpo a corpo com essa arma, e o dado de dano da arma passa a ser 1d8. A arma também se torna mágica, caso ainda não seja. A magia termina se você conjurá-la novamente ou soltar a arma.",
  ],
  "shocking grasp": [
    "Um raio salta da sua mão para eletrocutar uma criatura que você tentar tocar. Faça um ataque mágico corpo a corpo contra o alvo. Você tem vantagem na jogada de ataque se o alvo estiver usando armadura de metal. Se acertar, ele sofre 1d8 de dano elétrico e não pode realizar reações até o início do próximo turno dele.",
    "O dano desta magia aumenta em 1d8 quando você alcança o 5º nível (2d8), o 11º nível (3d8) e o 17º nível (4d8).",
  ],
  "spare the dying": [
    "Você toca uma criatura viva que tenha 0 pontos de vida. Ela fica estável. Esta magia não tem efeito sobre mortos-vivos nem construtos.",
  ],
  "thaumaturgy": [
    "Você manifesta uma pequena maravilha, um sinal de poder sobrenatural, dentro do alcance. Crie um dos seguintes efeitos mágicos:",
    "• Sua voz fica até três vezes mais alta que o normal por 1 minuto.",
    "• Você faz chamas tremeluzirem, ficarem mais brilhantes ou fracas, ou mudarem de cor por 1 minuto.",
    "• Você provoca tremores inofensivos no chão por 1 minuto.",
    "• Você cria um som instantâneo que se origina de um ponto à sua escolha dentro do alcance, como um trovão, o grasnado de um corvo ou sussurros sinistros.",
    "• Você faz instantaneamente uma porta ou janela destrancada se abrir de repente ou bater.",
    "• Você altera a aparência dos seus olhos por 1 minuto.",
    "Se conjurar esta magia várias vezes, pode manter até três de seus efeitos de 1 minuto ativos ao mesmo tempo. Você pode dispensar esses efeitos usando uma ação.",
  ],
  "true strike": [
    "Você estende a mão e aponta o dedo para um alvo dentro do alcance. Sua magia concede uma breve percepção das defesas dele. No seu próximo turno, você tem vantagem na sua primeira jogada de ataque contra esse alvo, desde que a magia ainda não tenha terminado.",
  ],
  "vicious mockery": [
    "Você profere uma série de insultos imbuídos de encantamentos sutis contra uma criatura que possa ver dentro do alcance. Se o alvo puder ouvir você — mesmo que não compreenda o que diz —, deve ser bem-sucedido em um teste de resistência de Sabedoria ou sofre 1d4 de dano psíquico e tem desvantagem na próxima jogada de ataque que fizer antes do fim do próximo turno dele.",
    "O dano desta magia aumenta em 1d4 quando você alcança o 5º nível (2d4), o 11º nível (3d4) e o 17º nível (4d4).",
  ],
};

const trickMaterialTranslations = {
  "dancing lights": "Um pouco de fósforo ou madeira de aveleira, ou um vaga-lume.",
  light: "Um vaga-lume ou musgo fosforescente.",
  mending: "Duas pedras-ímã.",
  message: "Um pequeno pedaço de fio de cobre.",
  "minor illusion": "Um pouco de lã.",
  resistance: "Uma capa em miniatura.",
  shillelagh: "Visco, uma folha de trevo e uma clava ou bordão.",
};

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

const monsterTypeTranslations = {
  aberration: "Aberração",
  beast: "Besta",
  celestial: "Celestial",
  construct: "Constructo",
  dragon: "Dragão",
  elemental: "Elemental",
  fey: "Feérico",
  fiend: "Corruptor",
  giant: "Gigante",
  humanoid: "Humanoide",
  monstrosity: "Monstruosidade",
  ooze: "Gosma",
  plant: "Planta",
  undead: "Morto-vivo",
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
  abjuration: "Abjuração",
  conjuration: "Conjuração",
  divination: "Adivinhação",
  enchantment: "Encantamento",
  evocation: "Evocação",
  illusion: "Ilusão",
  necromancy: "Necromancia",
  transmutation: "Transmutação",
};

const spellClassTranslations = {
  bard: "Bardo",
  cleric: "Clérigo",
  druid: "Druida",
  sorcerer: "Feiticeiro",
  warlock: "Bruxo",
  wizard: "Mago",
};

const ruleCategories = {
  testes: "Testes",
  acoes: "Ações em combate",
  combate: "Combate",
  dano: "Dano e cura",
  magia: "Magia",
  condicoes: "Condições",
  exploracao: "Exploração e descanso",
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

const labels = {
  spells: "Magias",
  tricks: "Truques",
  monsters: "Criaturas",
  rules: "Regras",
  campaigns: "Campanhas",
  dashboard: "Visão geral",
  initiative: "Iniciativa",
  notes: "Anotações",
  backup: "Dados e backup",
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
    showToast("Não foi possível salvar. Verifique o espaço disponível no navegador.");
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
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function getLocalizedName(name, translations) {
  return capitalizeFirst(translations[normalizeSearchTerm(name)]?.[0] || name);
}

function localizeSpellValue(value) {
  if (!value) return "";
  return String(value)
    .replace(/\binstantaneous\b/gi, "instantânea")
    .replace(/\bup to\b/gi, "até")
    .replace(/\b(\d+)\s+minutes?\b/gi, (_, amount) => `${amount} ${amount === "1" ? "minuto" : "minutos"}`)
    .replace(/\b(\d+)\s+rounds?\b/gi, (_, amount) => `${amount} ${amount === "1" ? "rodada" : "rodadas"}`)
    .replace(/\b(\d+)\s+hours?\b/gi, (_, amount) => `${amount} ${amount === "1" ? "hora" : "horas"}`)
    .replace(/\b(\d+)\s+feet\b/gi, (_, amount) => `${amount} pés`)
    .replace(/\bbonus action(s)?\b/gi, "ação bônus")
    .replace(/\baction(s)?\b/gi, "ação")
    .replace(/\bminutes?\b/gi, "minutos")
    .replace(/\brounds?\b/gi, "rodadas")
    .replace(/\bhours?\b/gi, "horas")
    .replace(/\bfeet\b/gi, "pés")
    .replace(/\btouch\b/gi, "Toque")
    .replace(/\bself\b/gi, "Pessoal");
}

function getLocalizedMonsterName(name) {
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
  return monsterTypeTranslations[normalizeSearchTerm(type)] || type;
}

function getLocalizedMovement(movement) {
  const movementTypes = {
    burrow: "escavação",
    climb: "escalada",
    fly: "voo",
    swim: "natação",
    walk: "terrestre",
  };
  return Object.entries(movement || {})
    .map(([kind, value]) => `${movementTypes[kind] || kind}: ${String(value).replace(/ft\./g, "pés")}`)
    .join(", ");
}

function getArmorClassValue(monster) {
  if (Array.isArray(monster.armor_class)) return monster.armor_class[0]?.value ?? "";
  return monster.armor_class ?? "";
}

function formatMonsterValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const name = item.name || item.type?.name;
        const description = item.desc || item.value;
        return [name, description].filter(Boolean).join(": ");
      }
      return String(item);
    }).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    const localizedLabels = {
      darkvision: "visão no escuro",
      passive_perception: "percepção passiva",
      blindsight: "visão às cegas",
      tremorsense: "sentido sísmico",
      truesight: "visão verdadeira",
    };
    return Object.entries(value)
      .filter(([, item]) => item != null && item !== "" && String(item).toLowerCase() !== "undefined")
      .map(([key, item]) => `${localizedLabels[normalizeSearchTerm(key)] || key}: ${String(item).replace(/ft\./g, "pés")}`)
      .join(", ");
  }
  return value ? String(value) : "";
}

function buildMonsterTooltip(monster, tooltipId) {
  const abilities = [
    ["strength", "FOR"],
    ["dexterity", "DES"],
    ["constitution", "CON"],
    ["intelligence", "INT"],
    ["wisdom", "SAB"],
    ["charisma", "CAR"],
  ].map(([key, label]) => `<span>${label} <strong>${escapeHtml(monster[key] ?? "—")}</strong></span>`).join("");
  const properties = [
    ["Testes de resistência", formatMonsterValues(monster.saving_throws || {
      FOR: monster.strength_save,
      DES: monster.dexterity_save,
      CON: monster.constitution_save,
      INT: monster.intelligence_save,
      SAB: monster.wisdom_save,
      CAR: monster.charisma_save,
    })],
    ["Perícias", formatMonsterValues(monster.skills)],
    ["Resistências a dano", formatMonsterValues(monster.damage_resistances)],
    ["Imunidades a dano", formatMonsterValues(monster.damage_immunities)],
    ["Vulnerabilidades", formatMonsterValues(monster.damage_vulnerabilities)],
    ["Imunidades a condições", formatMonsterValues(monster.condition_immunities)],
    ["Sentidos", formatMonsterValues(monster.senses)],
    ["Idiomas", formatMonsterValues(monster.languages)],
  ].filter(([, value]) => value);
  const features = [
    ["Traços", monster.special_abilities || monster.traits],
    ["Ações", monster.actions],
    ["Ações bônus", monster.bonus_actions],
    ["Reações", monster.reactions],
    ["Ações lendárias", monster.legendary_actions],
  ].map(([heading, entries]) => {
    if (!Array.isArray(entries) || !entries.length) return "";
    return `<section><h4>${heading}</h4>${entries.map((entry) => `<p><strong>${escapeHtml(entry.name || "Habilidade")}:</strong> ${escapeHtml(entry.desc || entry.description || "")}</p>`).join("")}</section>`;
  }).join("");
  const propertyMarkup = properties.map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("");
  const sizeLabels = {
    tiny: "Miúdo",
    small: "Pequeno",
    medium: "Médio",
    large: "Grande",
    huge: "Enorme",
    gargantuan: "Imenso",
  };
  const alignmentLabels = {
    "lawful good": "leal e bom",
    "neutral good": "neutro e bom",
    "chaotic good": "caótico e bom",
    "lawful neutral": "leal e neutro",
    "true neutral": "neutro",
    "neutral": "neutro",
    "chaotic neutral": "caótico e neutro",
    "lawful evil": "leal e mau",
    "neutral evil": "neutro e mau",
    "chaotic evil": "caótico e mau",
    "unaligned": "sem alinhamento",
  };
  const size = sizeLabels[normalizeSearchTerm(monster.size)] || monster.size || "";
  const alignment = alignmentLabels[normalizeSearchTerm(monster.alignment)] || monster.alignment || "";
  const source = monster.document__title || (monster.provider === "open5e" ? "Open5e" : "SRD 2014");
  return `<div class="combatant-tooltip" id="${tooltipId}" role="tooltip">
    <div class="tooltip-heading"><strong>${escapeHtml(getLocalizedMonsterName(monster.name))}</strong><span>ND ${escapeHtml(monster.challenge_rating ?? monster.cr ?? "—")}</span></div>
    <p class="tooltip-subtitle">${escapeHtml(size)} ${escapeHtml(getLocalizedMonsterType(monster.type || ""))}${alignment ? ` · ${escapeHtml(alignment)}` : ""}</p>
    <p class="tooltip-subtitle">Fonte: ${escapeHtml(source)}</p>
    <p><strong>CA:</strong> ${escapeHtml(getArmorClassValue(monster) || "—")} · <strong>PV:</strong> ${escapeHtml(monster.hit_points ?? "—")} ${monster.hit_dice ? `(${escapeHtml(monster.hit_dice)})` : ""}</p>
    <p><strong>Deslocamento:</strong> ${escapeHtml(getLocalizedMovement(monster.speed) || "—")}</p>
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
      <span class="suggestion-source">${escapeHtml({ open5e: creature.document__title || "Open5e", custom: "Minhas criaturas" }[creature.provider] || "SRD 2014")}</span>
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
    status.textContent = "Digite pelo menos 2 letras para buscar no SRD 2014.";
    return;
  }
  status.textContent = "Buscando no SRD 2014 e nas fontes abertas...";
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
    const customCreatures = state.customCreatures.filter((creature) => (
      normalizeSearchTerm(creature.name).includes(normalizedQuery)
      || normalizeSearchTerm(getLocalizedMonsterName(creature.name)).includes(normalizedQuery)
    ));
    state.initiative.creatures = [...customCreatures, ...officialCreatures, ...open5eCreatures].slice(0, 12);
    renderCreatureSuggestions(state.initiative.creatures);
    status.textContent = state.initiative.creatures.length
      ? `${state.initiative.creatures.length} sugestão(ões) encontradas no SRD 2014 e em fontes abertas.`
      : "Nenhuma criatura encontrada; você ainda pode adicionar o nome manualmente.";
    if (officialResult.status === "rejected" && open5eResult.status === "rejected" && !state.initiative.creatures.length) {
      status.textContent = "Busca indisponível. Você ainda pode adicionar o nome manualmente.";
    }
  } catch (error) {
    if (requestId !== state.initiative.requestId) return;
    console.error("Falha ao buscar criaturas para a iniciativa.", error);
    state.initiative.creatures = [];
    renderCreatureSuggestions([]);
    status.textContent = "Busca indisponível. Você ainda pode adicionar o nome manualmente.";
  }
  listbox.hidden = state.initiative.creatures.length === 0;
}

async function selectInitiativeCreature(creature) {
  const requestId = ++state.initiative.requestId;
  const status = document.querySelector("#creature-search-status");
  status.textContent = `Carregando ficha de ${creature.name}...`;
  renderCreatureSuggestions([]);
  try {
    const detail = ["open5e", "custom"].includes(creature.provider)
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
    status.textContent = `Ficha carregada: ${detail.name} (${source}). PV e CA preenchidos; ajuste se necessário.`;
  } catch (error) {
    if (requestId !== state.initiative.requestId) return;
    console.error(`Falha ao carregar ficha de ${creature.name}.`, error);
    state.initiative.selectedMonster = null;
    status.textContent = "Não foi possível carregar a ficha. Os valores podem ser preenchidos manualmente.";
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
  button.dataset.imageAlt = `Imagem de ${name}`;
  button.setAttribute("aria-label", `Ampliar imagem de ${name}`);
  button.title = `Ampliar imagem de ${name}`;
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
    select.innerHTML = `<option value="">Todas as fontes abertas</option>${data.results
      .map((source) => `<option value="${escapeHtml(source.slug)}">${escapeHtml(source.title)}</option>`)
      .join("")}`;
  } catch (error) {
    console.error("Falha ao carregar o índice de publicações abertas do Open5e.", error);
    showToast("Não foi possível carregar a lista de publicações Open5e.");
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

async function loadSpells() {
  const requestId = ++state.spells.requestId;
  const feedback = document.querySelector("#spell-feedback");
  const count = document.querySelector("#spell-count");
  feedback.textContent = "Consultando o compêndio...";
  feedback.classList.remove("is-error");
  document.querySelector("#spell-list").innerHTML = "";
  document.querySelector("#spell-count").textContent = "Buscando...";
  const params = new URLSearchParams();
  if (state.spells.query) params.set("name", resolveSearchTerm(state.spells.query, spellTranslations));
  if (state.spells.level) params.set("level", state.spells.level);
  try {
    const data = await requestApi(`/spells?${params}`);
    if (requestId !== state.spells.requestId) return;
    state.spells.results = data.results;
    state.spells.visibleCount = PAGE_SIZE;
    renderSpells();
    count.textContent = `${Math.min(state.spells.visibleCount, data.count)} de ${data.count} ${data.count === 1 ? "magia" : "magias"}`;
    feedback.textContent = state.spells.results.length ? "" : "Nenhuma magia encontrada. Tente outro nome ou círculo.";
    document.querySelector("#spell-more").hidden = state.spells.results.length <= state.spells.visibleCount;
  } catch (error) {
    if (requestId !== state.spells.requestId) return;
    console.error("Falha ao carregar magias da D&D 5e API.", error);
    feedback.textContent = "Não foi possível carregar as magias. Verifique sua conexão e tente novamente.";
    feedback.classList.add("is-error");
    count.textContent = "Compêndio indisponível";
  }
}

function renderSpells() {
  const list = document.querySelector("#spell-list");
  list.innerHTML = state.spells.results.slice(0, state.spells.visibleCount).map((spell) => `
    <button class="resource-card" type="button" data-resource="spells" data-index="${state.spells.results.indexOf(spell)}">
      <div class="resource-card-top"><h3>${escapeHtml(getLocalizedName(spell.name, spellTranslations))}</h3></div>
      <p>${getLocalizedName(spell.name, spellTranslations) !== spell.name ? escapeHtml(spell.name) : "Magia · SRD 2014"}</p>
      <div class="resource-meta"><span>Ver círculo, alcance e descrição</span>${icon("arrow-right")}</div>
    </button>`).join("");
}

async function loadTricks() {
  const requestId = ++state.tricks.requestId;
  const feedback = document.querySelector("#trick-feedback");
  const count = document.querySelector("#trick-count");
  feedback.textContent = "Consultando os truques...";
  feedback.classList.remove("is-error");
  document.querySelector("#trick-list").innerHTML = "";
  count.textContent = "Buscando...";
  try {
    if (!state.tricks.catalog) {
      const data = await requestApi("/spells?level=0");
      state.tricks.catalog = data.results;
    }
    if (requestId !== state.tricks.requestId) return;
    const query = normalizeSearchTerm(state.tricks.query);
    state.tricks.results = state.tricks.catalog.filter((spell) => (
      normalizeSearchTerm(spell.name).includes(query)
      || normalizeSearchTerm(getLocalizedName(spell.name, spellTranslations)).includes(query)
    ));
    state.tricks.visibleCount = PAGE_SIZE;
    renderTricks();
    count.textContent = `${Math.min(state.tricks.visibleCount, state.tricks.results.length)} de ${state.tricks.results.length} ${state.tricks.results.length === 1 ? "truque" : "truques"}`;
    feedback.textContent = state.tricks.results.length ? "" : "Nenhum truque encontrado. Tente outro nome.";
    document.querySelector("#trick-more").hidden = state.tricks.results.length <= state.tricks.visibleCount;
    const missingTranslations = state.tricks.catalog.filter((spell) => !trickDescriptions[normalizeSearchTerm(spell.name)]);
    if (missingTranslations.length) {
      console.error("Descrições de truques sem tradução PT-BR.", missingTranslations.map((spell) => spell.name));
      feedback.textContent = `${missingTranslations.length} truque(s) ainda sem descrição traduzida.`;
    }
  } catch (error) {
    if (requestId !== state.tricks.requestId) return;
    console.error("Falha ao carregar truques da D&D 5e API.", error);
    feedback.textContent = "Não foi possível carregar os truques. Verifique sua conexão e tente novamente.";
    feedback.classList.add("is-error");
    count.textContent = "Compêndio indisponível";
  }
}

function renderTricks() {
  document.querySelector("#trick-list").innerHTML = state.tricks.results
    .slice(0, state.tricks.visibleCount)
    .map((spell, index) => `
      <button class="resource-card" type="button" data-resource="tricks" data-index="${index}">
        <div class="resource-card-top"><h3>${escapeHtml(getLocalizedName(spell.name, spellTranslations))}</h3></div>
        <p>${getLocalizedName(spell.name, spellTranslations) !== spell.name ? escapeHtml(spell.name) : "Truque · SRD 2014"}</p>
        <div class="resource-meta"><span>Ver descrição em português</span>${icon("arrow-right")}</div>
      </button>`).join("");
}

async function loadMonsters({ append = false } = {}) {
  const requestId = ++state.monsters.requestId;
  const feedback = document.querySelector("#monster-feedback");
  const count = document.querySelector("#monster-count");
  feedback.textContent = "Consultando o bestiário...";
  feedback.classList.remove("is-error");
  if (!append) {
    document.querySelector("#monster-list").innerHTML = "";
    count.textContent = "Buscando...";
  }
  document.querySelector("#monster-source-label").textContent = {
    open5e: "Open5e · conteúdo de fontes abertas",
    custom: "Minhas criaturas · salvas neste navegador",
  }[state.monsters.provider] || "D&D 5e API · regras de 2014";
  try {
    let data;
    if (state.monsters.provider === "open5e") {
      let url = state.monsters.next;
      if (!append || !url) {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (state.monsters.query) params.set("name__icontains", getMonsterSearchName(state.monsters.query));
        if (state.monsters.documentSlug) params.set("document__slug", state.monsters.documentSlug);
        url = `${OPEN5E_BASE}/monsters/?${params}`;
      }
      data = await requestExternalJson(url, "api.open5e.com");
      if (requestId !== state.monsters.requestId) return;
      const results = data.results.map((monster) => ({ ...monster, provider: "open5e" }));
      state.monsters.results = append ? [...state.monsters.results, ...results] : results;
      state.monsters.next = data.next;
      state.monsters.total = data.count;
      state.monsters.visibleCount = state.monsters.results.length;
    } else if (state.monsters.provider === "custom") {
      const query = normalizeSearchTerm(state.monsters.query);
      state.monsters.results = state.customCreatures.filter((creature) => (
        !query
        || normalizeSearchTerm(creature.name).includes(query)
        || normalizeSearchTerm(getLocalizedMonsterName(creature.name)).includes(query)
      ));
      state.monsters.next = null;
      state.monsters.total = state.monsters.results.length;
      state.monsters.visibleCount = PAGE_SIZE;
    } else {
      if (!state.monsters.nameIndex) {
        data = await requestApi("/monsters");
        state.monsters.nameIndex = data.results;
      }
      if (requestId !== state.monsters.requestId) return;
      const query = normalizeSearchTerm(state.monsters.query);
      const resolvedQuery = normalizeSearchTerm(getMonsterSearchName(state.monsters.query));
      const matchingMonsters = query
        ? state.monsters.nameIndex.filter((monster) => (
          normalizeSearchTerm(monster.name).includes(query)
          || normalizeSearchTerm(getLocalizedMonsterName(monster.name)).includes(query)
          || normalizeSearchTerm(monster.name).includes(resolvedQuery)
        ))
        : state.monsters.nameIndex;
      state.monsters.results = matchingMonsters.map((monster) => ({ ...monster, provider: "dnd5e" }));
      state.monsters.next = null;
      state.monsters.total = state.monsters.results.length;
      state.monsters.visibleCount = PAGE_SIZE;
    }
    renderMonsters();
    loadVisibleMonsterImages(requestId);
    const visibleCount = Math.min(state.monsters.visibleCount, state.monsters.total);
    count.textContent = `${visibleCount} de ${state.monsters.total} ${state.monsters.total === 1 ? "criatura" : "criaturas"}`;
    feedback.textContent = state.monsters.results.length ? "" : (
      state.monsters.provider === "custom" && !state.customCreatures.length
        ? "Nenhuma criatura importada ainda. Use “Importar criaturas (JSON)”."
        : "Nenhuma criatura encontrada. Tente outro nome ou publicação."
    );
    document.querySelector("#monster-more").hidden = state.monsters.provider === "open5e"
      ? !state.monsters.next
      : state.monsters.results.length <= state.monsters.visibleCount;
  } catch (error) {
    if (requestId !== state.monsters.requestId) return;
    console.error(
      state.monsters.provider === "open5e"
        ? "Falha ao carregar criaturas do Open5e."
        : "Falha ao carregar criaturas da D&D 5e API.",
      error,
    );
    feedback.textContent = "Não foi possível carregar as criaturas. Verifique sua conexão e tente novamente.";
    feedback.classList.add("is-error");
    count.textContent = "Bestiário indisponível";
  }
}

function renderMonsters() {
  document.querySelector("#monster-list").innerHTML = state.monsters.results.slice(0, state.monsters.visibleCount).map((monster, index) => `
    <article class="resource-card">
      <div class="resource-card-top">
        <button class="resource-card-open monster-card-name" type="button" data-resource="monsters" data-index="${index}"><h3>${escapeHtml(getLocalizedMonsterName(monster.name))}</h3></button>
        <button class="monster-image-button" type="button" data-image-preview data-image-url="${escapeHtml(getMonsterImageUrl(monster) || state.monsters.imageCache.get(getMonsterImageCacheKey(monster)) || "")}" data-image-alt="Imagem de ${escapeHtml(getLocalizedMonsterName(monster.name))}" aria-label="Ampliar imagem de ${escapeHtml(getLocalizedMonsterName(monster.name))}" title="Ampliar imagem" ${getMonsterImageUrl(monster) || state.monsters.imageCache.get(getMonsterImageCacheKey(monster)) ? "" : "hidden"}>▧</button>
      </div>
      <button class="resource-card-details" type="button" data-resource="monsters" data-index="${index}">
        <p>${getLocalizedMonsterName(monster.name) !== monster.name ? `${escapeHtml(monster.name)} · ` : ""}${escapeHtml(monster.document__title || "SRD 2014")}</p>
        <span class="resource-meta"><span>${escapeHtml(monster.type ? getLocalizedMonsterType(monster.type) : "Ver ficha e estatísticas")}</span>${icon("arrow-right")}</span>
      </button>
    </article>`).join("");
}

async function showResourceDetails(category, index, resourceOverride = null) {
  const resource = resourceOverride || state[category].results[index];
  if (!resource) return;
  const dialog = document.querySelector("#detail-dialog");
  const body = document.querySelector("#detail-body");
  const isSpell = category === "spells" || category === "tricks";
  const isTrick = category === "tricks";
  document.querySelector("#detail-kicker").textContent = isSpell
    ? `${category === "tricks" ? "TRUQUE" : "MAGIA"} · D&D 5E 2014`
    : "CRIATURA · D&D 5E 2014";
  document.querySelector("#detail-title").textContent = isSpell
    ? getLocalizedName(resource.name, spellTranslations)
    : getLocalizedMonsterName(resource.name);
  const detailImageButton = document.querySelector("#detail-image-button");
  setMonsterImageButton(detailImageButton, "", "");
  document.querySelector("#detail-chips").innerHTML = "";
  body.textContent = "Carregando detalhes...";
  dialog.showModal();
  try {
    const detail = category === "monsters" && ["open5e", "custom"].includes(resource.provider)
      ? resource
      : await requestApi(resource.url);
    let imageMarkup = "";
    if (category === "monsters") {
      const monsterDetail = { ...detail, provider: resource.provider || "dnd5e" };
      const imageUrl = getMonsterImageUrl(monsterDetail);
      state.monsters.imageCache.set(getMonsterImageCacheKey(resource), imageUrl);
      setMonsterImageButton(
        detailImageButton,
        imageUrl,
        getLocalizedMonsterName(detail.name),
      );
      imageMarkup = imageUrl
        ? `<button class="detail-monster-image" type="button" data-image-preview data-image-url="${escapeHtml(imageUrl)}" data-image-alt="Imagem de ${escapeHtml(getLocalizedMonsterName(detail.name))}" aria-label="Ampliar imagem de ${escapeHtml(getLocalizedMonsterName(detail.name))}"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" /><span>Ampliar imagem</span></button>`
        : "";
    }
    if (isSpell) {
      const trickKey = normalizeSearchTerm(detail.name);
      const translatedDescription = isTrick ? trickDescriptions[trickKey] : null;
      if (isTrick && !translatedDescription) {
        console.error(`Tradução PT-BR não cadastrada para o truque "${detail.name}".`);
      }
      const components = (detail.components || []).map((component) => ({
        V: "Verbal",
        S: "Somático",
        M: "Material",
      })[component] || component);
      const school = spellSchoolTranslations[normalizeSearchTerm(detail.school?.name)] || detail.school?.name;
      document.querySelector("#detail-chips").innerHTML = [
        `Nome original na API: ${detail.name}`,
        detail.level === 0 ? "Truque" : `${detail.level}º círculo`,
        isTrick && school ? `Escola: ${school}` : school,
        isTrick ? `Conjuração: ${localizeSpellValue(detail.casting_time)}` : detail.casting_time,
        isTrick ? `Alcance: ${localizeSpellValue(detail.range)}` : detail.range,
        isTrick ? `Duração: ${localizeSpellValue(detail.duration)}` : detail.duration,
        isTrick && components.length ? `Componentes: ${components.join(", ")}` : "",
        isTrick && detail.classes?.length
          ? `Classes: ${detail.classes.map((spellClass) => spellClassTranslations[normalizeSearchTerm(spellClass.name)] || spellClass.name).join(", ")}`
          : "",
      ].filter(Boolean).map((chip) => `<span class="detail-chip">${escapeHtml(chip)}</span>`).join("");
      const material = isTrick && detail.material
        ? `<p><strong>Material:</strong> ${escapeHtml(trickMaterialTranslations[trickKey] || detail.material)}</p>`
        : "";
      const description = translatedDescription || detail.desc || [];
      const translationNotice = isTrick && !translatedDescription
        ? `<p class="is-error">A tradução deste truque ainda não está disponível; o texto original da API é exibido abaixo.</p><h3>Descrição original</h3>`
        : "";
      body.innerHTML = `${translationNotice}${(description).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}${material}${detail.higher_level?.length ? `<h3>Em círculos superiores</h3>${detail.higher_level.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}` : ""}`;
    } else {
      const armor = Array.isArray(detail.armor_class)
        ? detail.armor_class.map((entry) => `${entry.value}${entry.type ? ` (${entry.type})` : ""}`).join(", ")
        : detail.armor_class ?? "—";
      const challengeRating = detail.challenge_rating ?? detail.cr ?? "—";
      document.querySelector("#detail-chips").innerHTML = [
        `Nome original: ${detail.name}`,
        detail.size,
        detail.type ? getLocalizedMonsterType(detail.type) : "",
        detail.alignment,
        `ND ${challengeRating}`,
        detail.document__title,
      ].filter(Boolean).map((chip) => `<span class="detail-chip">${escapeHtml(chip)}</span>`).join("");
      const abilities = [
        ["strength", "FOR"],
        ["dexterity", "DES"],
        ["constitution", "CON"],
        ["intelligence", "INT"],
        ["wisdom", "SAB"],
        ["charisma", "CAR"],
      ].map(([ability, abbreviation]) => `${abbreviation} ${detail[ability] ?? "—"}`).join(" · ");
      const actionGroups = [
        ["Habilidades", detail.special_abilities],
        ["Ações", detail.actions],
        ["Ações bônus", detail.bonus_actions],
        ["Reações", detail.reactions],
        ["Ações lendárias", detail.legendary_actions],
        ["Ações de covil", detail.lair_actions],
      ].map(([heading, entries]) => {
        const content = (entries || []).map((entry) => `<p><strong>${escapeHtml(entry.name)}.</strong> ${escapeHtml(entry.desc)}</p>`).join("");
        return content ? `<h3>${heading}</h3>${content}` : "";
      }).join("");
      const description = detail.desc ? `<p>${escapeHtml(detail.desc)}</p>` : "";
      const sourceUrl = getSafeExternalUrl(detail.document__url);
      const licenseUrl = getSafeExternalUrl(detail.document__license_url);
      const sourceLinks = [
        sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ${icon("arrow-up-right")}</a>` : "",
        licenseUrl ? `<a href="${escapeHtml(licenseUrl)}" target="_blank" rel="noopener noreferrer">Licença ${icon("arrow-up-right")}</a>` : "",
      ].filter(Boolean).join(" · ");
      body.innerHTML = `${imageMarkup}${description}<p><strong>Classe de Armadura:</strong> ${escapeHtml(armor)} · <strong>Pontos de Vida:</strong> ${escapeHtml(detail.hit_points)} (${escapeHtml(detail.hit_dice)})</p><p><strong>Deslocamento:</strong> ${escapeHtml(getLocalizedMovement(detail.speed) || "—")}</p><p><strong>Atributos:</strong> ${escapeHtml(abilities)}</p>${detail.languages ? `<p><strong>Idiomas:</strong> ${escapeHtml(detail.languages)}</p>` : ""}${actionGroups}${sourceLinks ? `<p>${sourceLinks}</p>` : ""}`;
    }
    document.querySelector(".dialog-source").textContent = category === "monsters" && detail.document__title
      ? `Fonte: ${detail.document__title}${detail.document__license ? ` · ${detail.document__license}` : ""}`
      : "Dados de referência da API D&D 5e · 2014";
  } catch (error) {
    console.error(`Falha ao carregar detalhes de ${category}.`, error);
    body.textContent = "Não foi possível carregar os detalhes. Feche esta janela e tente novamente.";
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
  document.querySelector("#detail-kicker").textContent = `REGRA · ${ruleCategories[rule.category]}`;
  document.querySelector("#detail-title").textContent = rule.title;
  document.querySelector("#detail-chips").innerHTML = "";
  document.querySelector("#detail-body").innerHTML = renderRuleBody(rule);
  document.querySelector(".dialog-source").textContent = "Resumo próprio baseado nas regras básicas de 2014";
  if (!dialog.open) dialog.showModal();
}

const SUGGESTED_RULES = ["Concentração", "Ataque de oportunidade", "Cobertura", "Agarrar", "Testes contra a morte"];

function renderInitiativeRuleResults() {
  const query = document.querySelector("#initiative-rule-search").value;
  const results = query.trim()
    ? searchRules(query).slice(0, 6)
    : SUGGESTED_RULES.map((title) => quickRules.find((rule) => rule.title === title)).filter(Boolean);
  const container = document.querySelector("#initiative-rule-results");
  container.innerHTML = results.length
    ? `${query.trim() ? "" : `<small class="rule-results-label">Mais consultadas</small>`}${results.map((rule) => `
      <button class="rule-result" type="button" data-rule-title="${escapeHtml(rule.title)}"><span>${escapeHtml(rule.title)}</span><small>${escapeHtml(ruleCategories[rule.category])}</small></button>`).join("")}`
    : `<small class="rule-results-label">Nenhuma regra encontrada.</small>`;
}

function renderRules() {
  const filteredRules = searchRules(document.querySelector("#rules-search").value, document.querySelector("#rules-category").value);
  document.querySelector("#rules-list").innerHTML = filteredRules.map((rule) => `
    <article class="rule-card">
      <span class="rule-category">${escapeHtml(ruleCategories[rule.category])}</span>
      <h2>${escapeHtml(rule.title)}</h2>
      ${renderRuleBody(rule)}
    </article>`).join("");
  document.querySelector("#rules-count").textContent = `${filteredRules.length} ${filteredRules.length === 1 ? "regra" : "regras"}`;
  document.querySelector("#rules-feedback").textContent = filteredRules.length
    ? ""
    : "Nenhuma regra encontrada. Tente outra palavra.";
}

async function searchInitiativeSpells(query) {
  const requestId = ++state.initiativeSpells.requestId;
  const listbox = document.querySelector("#initiative-spell-suggestions");
  const status = document.querySelector("#initiative-spell-status");
  if (!listbox) return;

  const normalizedQuery = normalizeSearchTerm(query);
  if (normalizedQuery.length < 2) {
    state.initiativeSpells.results = [];
    listbox.innerHTML = "";
    listbox.hidden = true;
    document.querySelector("#initiative-spell-search").setAttribute("aria-expanded", "false");
    status.textContent = "Digite pelo menos 2 letras para buscar magias e truques.";
    return;
  }

  status.textContent = "Buscando no compêndio...";
  listbox.hidden = true;
  try {
    if (!state.initiativeSpells.catalog || !state.initiativeSpells.trickNames) {
      const [spellData, trickData] = await Promise.all([
        requestApi("/spells"),
        requestApi("/spells?level=0"),
      ]);
      state.initiativeSpells.catalog = spellData.results;
      state.initiativeSpells.trickNames = new Set(trickData.results.map((spell) => normalizeSearchTerm(spell.name)));
    }
    if (requestId !== state.initiativeSpells.requestId) return;

    state.initiativeSpells.results = state.initiativeSpells.catalog
      .filter((spell) => {
        const aliases = spellTranslations[normalizeSearchTerm(spell.name)] || [];
        return [spell.name, ...aliases].some((name) => {
          const normalizedName = normalizeSearchTerm(name);
          return normalizedName.includes(normalizedQuery)
            || normalizedQuery.split(/\s+/).every((term) => normalizedName.includes(term));
        });
      })
      .map((spell) => ({
        ...spell,
        category: state.initiativeSpells.trickNames.has(normalizeSearchTerm(spell.name)) ? "tricks" : "spells",
      }))
      .slice(0, 12);
    listbox.innerHTML = state.initiativeSpells.results.map((spell, index) => `
      <button class="spell-suggestion" type="button" role="option" data-resource="${spell.category}" data-index="${index}">
        <span class="spell-suggestion-copy"><strong>${escapeHtml(getLocalizedName(spell.name, spellTranslations))}</strong><small>${escapeHtml(spell.name)}</small></span>
        <span class="suggestion-level">${spell.category === "tricks" ? "Truque" : "Magia"}</span>
      </button>`).join("");

    listbox.hidden = state.initiativeSpells.results.length === 0;
    document.querySelector("#initiative-spell-search").setAttribute("aria-expanded", String(!listbox.hidden));
    status.textContent = state.initiativeSpells.results.length
      ? `${state.initiativeSpells.results.length} resultado(s). Selecione para abrir a ficha.`
      : "Nenhuma magia ou truque encontrado. Tente o nome em português ou inglês.";
  } catch (error) {
    if (requestId !== state.initiativeSpells.requestId) return;
    console.error("Falha ao buscar magias para a iniciativa.", error);
    state.initiativeSpells.results = [];
    listbox.innerHTML = "";
    listbox.hidden = true;
    document.querySelector("#initiative-spell-search").setAttribute("aria-expanded", "false");
    status.textContent = "Não foi possível consultar o compêndio. Verifique sua conexão e tente novamente.";
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
  if (hp === 0) return { key: "down", label: combatant.isPlayer ? "Caído" : "Abatido", ratio };
  if (ratio <= 0.25) return { key: "critical", label: "Crítico", ratio };
  if (ratio <= 0.5) return { key: "bloodied", label: "Sangrando", ratio };
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
        <label class="combatant-score" title="Iniciativa (clique para editar)"><span class="turn-index">${index + 1}º</span><input class="combatant-score-input" type="number" step="any" min="-10" max="99" value="${escapeHtml(combatant.score)}" data-score-for="${id}" aria-label="Iniciativa de ${escapeHtml(combatant.name)}" /></label>
        <div class="combatant-main">
        <span class="combatant-name-wrap">
          ${combatant.monster
              ? `<span class="combatant-name-with-image"><button class="combatant-name creature-name" type="button" aria-describedby="creature-tip-${id}">${escapeHtml(combatant.name)}</button>${combatant.isPlayer ? `<span class="pc-badge" title="Personagem jogador">PJ</span>` : ""}${getMonsterImageUrl(combatant.monster) ? `<button class="monster-image-button" type="button" data-image-preview data-image-url="${escapeHtml(getMonsterImageUrl(combatant.monster))}" data-image-alt="Imagem de ${escapeHtml(combatant.name)}" aria-label="Ampliar imagem de ${escapeHtml(combatant.name)}" title="Ampliar imagem">${icon("image")}</button>` : ""}</span>${buildMonsterTooltip(combatant.monster, `creature-tip-${id}`)}`
            : `<span class="combatant-name-with-image"><span class="combatant-name">${escapeHtml(combatant.name)}</span>${combatant.isPlayer ? `<span class="pc-badge" title="Personagem jogador">PJ</span>` : ""}</span>`}
        </span>
        ${renderConditionChips(combatant)}
        </div>
        <span class="combatant-hp-cell">
          <label class="combatant-hp-control"><input class="combatant-hp-input" type="number" min="0" max="${combatant.maxHp || 9999}" value="${escapeHtml(combatant.hp)}" data-hp-for="${id}" aria-label="Pontos de vida atuais de ${escapeHtml(combatant.name)}" /><span>${combatant.maxHp ? `/ ${escapeHtml(combatant.maxHp)}` : ""} PV${tempHp ? ` <b class="temp-hp-tag" title="PV temporários">+${tempHp}</b>` : ""}</span></label>
          ${status ? `<span class="hp-bar hp-${status.key}" title="${Math.round(status.ratio * 100)}% dos PV"><span style="width: ${Math.round(status.ratio * 100)}%"></span></span>${status.label ? `<small class="hp-status hp-${status.key}">${status.label}</small>` : ""}` : ""}
        </span>
        <span class="combatant-ac" title="Classe de Armadura"><small>CA</small><b>${combatant.ac === "" || combatant.ac == null ? "—" : escapeHtml(combatant.ac)}</b></span>
        <button class="icon-button remove-combatant" type="button" data-remove="${id}" aria-label="Remover ${escapeHtml(combatant.name)}" title="Remover">${icon("x")}</button>
        ${renderCombatantExtras(combatant)}
      </div>`;
    }).join("");
}

function getActiveConditions(combatant) {
  return Array.isArray(combatant.conditions) ? combatant.conditions.filter((key) => conditionDefs[key]) : [];
}

function renderConditionChips(combatant) {
  const id = escapeHtml(combatant.id);
  const chips = getActiveConditions(combatant).map((key) => `<button class="condition-chip ${key === "concentrating" ? "is-concentration" : ""}" type="button" data-condition-remove="${id}" data-condition-key="${key}" title="${escapeHtml(conditionDefs[key][1])} (clique para remover)">${escapeHtml(conditionDefs[key][0])} ${icon("x")}</button>`).join("");
  return chips ? `<div class="combatant-conditions">${chips}</div>` : "";
}

function renderCombatantExtras(combatant) {
  const id = escapeHtml(combatant.id);
  const active = getActiveConditions(combatant);
  const options = Object.entries(conditionDefs)
    .filter(([key]) => !active.includes(key))
    .map(([key, [label]]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("");
  return `<div class="combatant-extras">
    <form class="hp-quick" data-hp-quick="${id}"><input class="hp-quick-input" type="text" inputmode="numeric" autocomplete="off" placeholder="−8 ou +5" aria-label="Dano ou cura de ${escapeHtml(combatant.name)}" /><button class="mini-button" type="submit" data-hp-mode="damage" title="Causa dano (PV temporários absorvem primeiro)">Dano</button><button class="mini-button" type="submit" data-hp-mode="heal" title="Cura até o máximo de PV">Cura</button></form>
    <label class="temp-hp-field" title="PV temporários absorvem dano antes dos PV atuais">Temp <input class="hp-quick-input temp-hp-input" type="number" min="0" max="999" value="${Number(combatant.tempHp) || ""}" placeholder="0" data-temp-for="${id}" aria-label="PV temporários de ${escapeHtml(combatant.name)}" /></label>
    <button class="mini-button" type="button" data-duplicate="${id}" title="Duplicar combatente">${icon("copy")} Duplicar</button>
    <button class="mini-button ${combatant.isPlayer ? "is-on" : ""}" type="button" data-toggle-player="${id}" aria-pressed="${Boolean(combatant.isPlayer)}" title="PJs são mantidos ao encerrar o combate e nunca são pulados">${combatant.isPlayer ? `${icon("check")} PJ` : "Marcar PJ"}</button>
    <select class="condition-add" data-condition-for="${id}" aria-label="Adicionar condição a ${escapeHtml(combatant.name)}"><option value="">+ Condição</option>${options}</select>
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
  showToast("Alteração desfeita.");
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
    showToast("Use um número, por exemplo 8 e depois Dano ou Cura (ou −8 / +5).");
    return;
  }
  if (combatant.hp === "" || combatant.hp == null) {
    showToast("Informe os PV atuais deste combatente antes de aplicar dano ou cura.");
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
    showToast(`${combatant.name}: +${amount} → ${next} PV.`);
    return;
  }
  const tempHp = Number(combatant.tempHp) || 0;
  const absorbed = Math.min(tempHp, amount);
  combatant.tempHp = tempHp - absorbed;
  const next = Math.max(0, current - (amount - absorbed));
  const wasConcentrating = setCombatantHp(combatant, next);
  persistCombatants();
  renderInitiative();
  const parts = [`${combatant.name}: −${amount} → ${next} PV`];
  if (absorbed) parts.push(`${absorbed} absorvido(s) pelos PV temporários`);
  if (next === 0) parts.push(combatant.isPlayer ? "caído e inconsciente" : "abatido");
  if (wasConcentrating && next === 0) parts.push("concentração perdida");
  else if (wasConcentrating && amount > 0) parts.push(`teste de concentração: CON CD ${Math.max(10, Math.floor(amount / 2))}`);
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
  showToast(`${base} duplicado${modifier === null ? "" : " com nova rolagem de iniciativa"}.`);
}

function rollAllMonsterInitiative() {
  const monsters = state.combatants.filter((item) => !item.isPlayer && getDexterityModifier(item.monster) !== null);
  if (!monsters.length) {
    showToast("Nenhum combatente com ficha de criatura para rolar.");
    return;
  }
  monsters.forEach((item) => {
    item.score = rollD20() + getDexterityModifier(item.monster);
  });
  state.currentCombatantId = getTurnOrder()[0].id;
  persistCombatants();
  renderInitiative();
  showToast(`Iniciativa rolada para ${monsters.length} ${monsters.length === 1 ? "criatura" : "criaturas"}.`);
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
    showToast("Adicione combatentes antes de avançar o turno.");
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
          showToast("Este já é o primeiro turno do combate.");
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
  showToast(`${combatant.name} removido.`, { label: "Desfazer", onClick: () => restoreInitiative(snapshot) });
}

function endCombat() {
  if (!state.combatants.length) return;
  const players = state.combatants.filter((item) => item.isPlayer);
  const removed = state.combatants.length - players.length;
  const message = players.length
    ? `Encerrar o combate? ${removed} criatura(s) serão removidas e ${players.length} PJ(s) mantidos.`
    : "Encerrar o combate? Todos os combatentes serão removidos (nenhum está marcado como PJ).";
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
  showToast("Combate encerrado.", { label: "Desfazer", onClick: () => restoreInitiative(snapshot) });
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
  document.querySelector("#notes-campaign-filter").innerHTML = campaignOptions(state.notesFilter, [["all", "Todas as anotações"], ["none", "Sem campanha"]]);
  const visible = getVisibleNotes();
  document.querySelector("#notes-list").innerHTML = visible.map((note) => {
    const campaign = state.campaigns.find((item) => item.id === note.campaignId);
    return `<button class="note-item ${note.id === state.activeNoteId ? "is-active" : ""}" type="button" data-note-id="${escapeHtml(note.id)}"><strong>${escapeHtml(note.title || "Sem título")}</strong><small>${escapeHtml(campaign?.name || "Sem campanha")}</small></button>`;
  }).join("");
  document.querySelector("#notes-empty").hidden = visible.length > 0;
  renderNoteEditor();
}

function renderNoteEditor() {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  const defaultCampaign = !["all", "none"].includes(state.notesFilter) ? state.notesFilter : "";
  document.querySelector("#notes-title").value = note?.title || "";
  document.querySelector("#notes-content").value = note?.content || "";
  document.querySelector("#notes-campaign").innerHTML = campaignOptions(note ? note.campaignId : defaultCampaign, [["", "Sem campanha"]]);
  document.querySelector("#delete-note").hidden = !note;
  document.querySelector("#notes-status").textContent = note ? "Salvo neste navegador" : "Nova anotação";
  state.notesDirty = false;
}

function selectNote(noteId) {
  if (state.notesDirty && !window.confirm("Descartar as alterações não salvas desta anotação?")) return;
  state.activeNoteId = noteId;
  renderNotes();
}

function saveCurrentNote() {
  const title = document.querySelector("#notes-title").value.trim();
  const content = document.querySelector("#notes-content").value;
  if (!title && !content.trim()) {
    showToast("Escreva um título ou algum texto antes de salvar.");
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
    showToast("Anotação salva.");
  } else {
    state.notes = previous;
  }
}

function deleteCurrentNote() {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  if (!note || !window.confirm(`Excluir a anotação “${note.title || "Sem título"}”?`)) return;
  state.notes = state.notes.filter((item) => item.id !== note.id);
  saveStored("cronica-notes", state.notes);
  state.activeNoteId = null;
  renderNotes();
  showToast("Anotação excluída.");
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
  if (file.size > maxBytes) throw new Error("O arquivo é grande demais (limite de 5 MB).");
  return JSON.parse(await file.text());
}

async function importCustomCreatures(file) {
  try {
    const raw = await readJsonFile(file);
    const list = Array.isArray(raw) ? raw : raw?.creatures ?? raw?.monsters;
    if (!Array.isArray(list)) throw new Error("Esperava uma lista de criaturas.");
    const valid = list.map(normalizeCustomCreature).filter(Boolean);
    if (!valid.length) {
      showToast("Nenhuma criatura válida no arquivo. Baixe o modelo para ver o formato.");
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
    showToast(`${valid.length} ${valid.length === 1 ? "criatura importada" : "criaturas importadas"}${skipped ? `; ${skipped} ignorada(s) por dados inválidos` : ""}.`);
    if (state.monsters.provider === "custom") loadMonsters();
  } catch (error) {
    console.error("Falha ao importar criaturas.", error);
    showToast("Não foi possível ler o arquivo. Confira se é um JSON válido.");
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
  document.querySelector("#backup-status").textContent = "Arquivo gerado. Guarde-o em um lugar seguro.";
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
    const summary = `${campaigns.length} campanha(s), ${combatants.length} combatente(s), ${notes.length} anotação(ões), ${customCreatures.length} criatura(s)`;
    if (!window.confirm(`Substituir os dados deste navegador por: ${summary}?`)) return;
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
    status.textContent = "Dados importados. Recarregando...";
    window.setTimeout(() => window.location.reload(), 600);
  } catch (error) {
    console.error("Falha ao importar o backup.", error);
    status.textContent = "Não foi possível importar: confira se o arquivo é um backup do BanD&D.";
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
        <div class="campaign-cover campaign-cover-${escapeHtml(["mountains", "forest", "ruins", "night"].includes(campaign.background) ? campaign.background : "mountains")}" data-campaign-cover="${escapeHtml(campaign.id)}"><span aria-hidden="true">${icon("d20")}</span><small>CAMPANHA</small></div>
        <div class="campaign-card-body"><div class="campaign-title-row"><div><h2>${escapeHtml(campaign.name)}</h2><p>${escapeHtml(campaign.description || "Uma nova história começa a ser escrita.")}</p></div><button class="icon-button campaign-edit-icon" type="button" data-edit-campaign="${escapeHtml(campaign.id)}" aria-label="Editar ${escapeHtml(campaign.name)}">${icon("more")}</button></div><div class="campaign-card-meta"><span>${icon("clock")} Campanha pronta para jogar</span></div><button class="button button-outline campaign-open" type="button" data-open-campaign="${escapeHtml(campaign.id)}">Abrir campanha ${icon("arrow-right")}</button></div>
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
  const name = campaign?.name || "Nenhuma campanha aberta";
  const description = campaign?.description || (campaign
    ? "Uma nova história começa a ser escrita."
    : "Abra ou crie uma campanha para acompanhar seus detalhes aqui.");
  const banner = document.querySelector("#dashboard-campaign-banner");
  const imageUrl = campaign?.background === "custom" ? getSafeExternalUrl(campaign.imageUrl) : "";

  document.querySelector("#dashboard-campaign-name").textContent = name;
  document.querySelector("#dashboard-campaign-description").textContent = description;
  document.querySelector("#dashboard-campaign-meta").innerHTML = campaign
    ? `<span>${icon("clock")} Campanha ativa</span>`
    : `<span>${icon("plus")} Crie sua primeira campanha</span>`;
  document.querySelector("#dashboard-activity-name").textContent = name;
  document.querySelector("#dashboard-activity-description").textContent = campaign
    ? "Última campanha aberta"
    : "Escolha uma campanha para continuar.";
  document.querySelector("#dashboard-open-campaign").disabled = !campaign;
  document.querySelectorAll("[data-open-active-campaign]").forEach((button) => {
    button.disabled = !campaign;
  });

  banner.dataset.background = imageUrl ? "custom" : campaign?.background || "mountains";
  banner.style.backgroundImage = imageUrl
    ? `linear-gradient(100deg, #151519e8 0%, #17171bd9 55%, #17191ecc 100%), url("${imageUrl}")`
    : "";
  document.querySelector("#dashboard-banner-art").hidden = Boolean(imageUrl);
}

function renderDashboardCombat() {
  const order = getTurnOrder();
  const current = order.find((combatant) => combatant.id === state.currentCombatantId);
  const players = order.filter((combatant) => combatant.isPlayer).length;
  document.querySelector("#dashboard-round").textContent = order.length ? String(state.round) : "—";
  document.querySelector("#dashboard-combat-title").textContent = current
    ? `Vez de ${current.name}`
    : "Nenhum combate em andamento";
  document.querySelector("#dashboard-combat-detail").textContent = order.length
    ? `${order.length} combatente(s) · ${players} PJ(s) · ${order.length - players} criatura(s)`
    : "Adicione combatentes na iniciativa para começar.";
}

function setActiveCampaign(campaign) {
  state.activeCampaignId = campaign?.id || null;
  try {
    if (state.activeCampaignId) localStorage.setItem("cronica-active-campaign", state.activeCampaignId);
    else localStorage.removeItem("cronica-active-campaign");
  } catch (error) {
    console.error("Não foi possível salvar a campanha ativa.", error);
    showToast("A campanha foi aberta, mas não foi possível salvar sua seleção neste navegador.");
  }
  renderDashboardCampaign();
}

function openCampaign(campaign) {
  setActiveCampaign(campaign);
  navigate("initiative");
  showToast(`Campanha “${campaign.name}” aberta. A iniciativa está pronta para a sessão.`);
}

function openCampaignEditor(campaign = null) {
  const dialog = document.querySelector("#campaign-editor");
  const form = document.querySelector("#campaign-editor-form");
  form.reset();
  state.editingCampaignId = campaign?.id || null;
  document.querySelector("#campaign-editor-title").textContent = campaign ? "Editar campanha" : "Nova campanha";
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

function setupEvents() {
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
    document.querySelector("#spell-count").textContent = `${Math.min(state.spells.visibleCount, state.spells.results.length)} de ${state.spells.results.length} magias`;
    document.querySelector("#spell-more").hidden = state.spells.results.length <= state.spells.visibleCount;
  });
  document.querySelector("#trick-more").addEventListener("click", () => {
    state.tricks.visibleCount += PAGE_SIZE;
    renderTricks();
    document.querySelector("#trick-count").textContent = `${Math.min(state.tricks.visibleCount, state.tricks.results.length)} de ${state.tricks.results.length} truques`;
    document.querySelector("#trick-more").hidden = state.tricks.results.length <= state.tricks.visibleCount;
  });
  document.querySelector("#monster-more").addEventListener("click", () => {
    if (state.monsters.provider === "open5e") {
      loadMonsters({ append: true });
      return;
    }
    state.monsters.visibleCount += PAGE_SIZE;
    renderMonsters();
    loadVisibleMonsterImages(++state.monsters.requestId);
    document.querySelector("#monster-count").textContent = `${Math.min(state.monsters.visibleCount, state.monsters.results.length)} de ${state.monsters.results.length} criaturas`;
    document.querySelector("#monster-more").hidden = state.monsters.results.length <= state.monsters.visibleCount;
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
    showMonsterImage(previewButton.dataset.imageUrl, previewButton.dataset.imageAlt || "Imagem da criatura");
  });
  document.querySelector(".dialog-close").addEventListener("click", () => document.querySelector("#detail-dialog").close());
  document.querySelector("#monster-image-close").addEventListener("click", () => document.querySelector("#monster-image-dialog").close());
  document.querySelector("#monster-image-preview").addEventListener("error", () => {
    document.querySelector("#monster-image-status").textContent = "A API informou uma imagem, mas ela não pôde ser carregada.";
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
      showToast("Informe a iniciativa ou use o botão do d20 para rolar.");
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
      if (rawScore === "") showToast(`${quantity > 1 ? `${quantity} combatentes adicionados` : `${name} adicionado`} com iniciativa rolada (d20 ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)}).`);
      form.reset();
      setMonsterImageButton(document.querySelector("#selected-creature-image"), "", "");
      state.initiative.selectedMonster = null;
      state.initiative.creatures = [];
      renderCreatureSuggestions([]);
      document.querySelector("#creature-search-status").textContent = "Digite para buscar criaturas do SRD 2014 e Open5e.";
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
      showToast(`Iniciativa: ${roll} no d20 ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)} de Destreza.`);
    } else if (state.initiative.selectedMonster) {
      showToast(`Iniciativa: ${roll} no d20. A ficha não informou Destreza para aplicar o modificador.`);
    } else {
      showToast("Iniciativa rolada sem modificador. Selecione uma criatura para somar a Destreza.");
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
    showToast("Rodada reiniciada.");
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
      document.querySelector("#initiative-rule-results [data-rule-title]")?.click();
    } else if (event.key === "Escape") {
      rulesLookup.open = false;
    }
  });
  document.querySelector("#initiative-rule-results").addEventListener("click", (event) => {
    const button = event.target.closest("[data-rule-title]");
    const rule = button && quickRules.find((item) => item.title === button.dataset.ruleTitle);
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
    if (state.notesDirty && !window.confirm("Descartar as alterações não salvas desta anotação?")) {
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
      document.querySelector("#notes-status").textContent = "Alterações não salvas";
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
  document.querySelector("#download-creature-template").addEventListener("click", () => downloadJson("modelo-criaturas.json", CREATURE_TEMPLATE));
  document.querySelector("#clear-creatures").addEventListener("click", () => {
    if (!state.customCreatures.length || !window.confirm("Remover todas as criaturas importadas deste navegador?")) return;
    state.customCreatures = [];
    saveStored("cronica-custom-creatures", state.customCreatures);
    if (state.monsters.provider === "custom") loadMonsters();
    showToast("Criaturas importadas removidas.");
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
        showToast("Informe pontos de vida dentro do limite permitido.");
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
        showToast("Informe uma iniciativa entre −10 e 99.");
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
      showToast("Informe uma URL de imagem HTTPS válida.");
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
      showToast(existingIndex >= 0 ? "Campanha atualizada." : `Campanha “${name}” criada.`);
    }
  });
  document.querySelector("#delete-editing-campaign").addEventListener("click", () => {
    const campaign = state.campaigns.find((item) => item.id === state.editingCampaignId);
    if (!campaign || !window.confirm(`Excluir a campanha “${campaign.name}”?`)) return;
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
      showToast("Campanha excluída.");
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

document.querySelector("#today-label").textContent = new Date()
  .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
  .toLocaleUpperCase("pt-BR");
setupEvents();
renderInitiative();
renderCampaigns();
const initialRoute = window.location.hash.slice(1);
const initialView = initialRoute === "inicio" ? "dashboard" : initialRoute;
navigate(initialView, { updateHistory: false, scroll: false });
if (!labels[initialRoute] || initialRoute !== initialView) {
  window.history.replaceState(null, "", `#${labels[initialView] ? initialView : "dashboard"}`);
}
