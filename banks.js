// Built-in word banks, 1st to 5th grade, grouped by spelling pattern, so a kid can practice with no
// setup and a grown-up can build a list by picking from them. Written for this plugin from common
// words and patterns. Words that sound like another word come with a sentence ("Use it in a
// sentence"), and HOMOPHONES keeps those partners out of the "Pick it" choices.
;(function (root) {
  const BANKS = [
    { grade: 1, name: '1st grade', patterns: [
      ['Short a', 'cat map hat bag ran sad can has man nap jam fan tap bat dad'],
      ['Short e', 'bed red ten pet leg net hen wet yes men get fed jet web'],
      ['Short i', 'big pig sit win him fix dig lip kid hid mix pin six wig'],
      ['Short o', 'hot dog top mom box pot job not fox log mop got hop rod'],
      ['Short u', 'bug cup sun run fun mud bus hug nut tub rug cut but gum pup'],
      ['Blends', 'stop frog flag clap drum grab slip crab trip swim plan snap step best hand jump lamp milk tent nest'],
      ['sh, ch, th, wh, ck', 'ship shop fish wish chin chop much rich this that then them with bath when whip duck back sock kick'],
      ['Silent e', 'cake make game name gate bike kite time ride five home rope nose bone cute tube mule made like hope'],
      ['Vowel teams', 'seed tree feet keep green rain play day boat road'],
      ['Tricky words', 'the said was of you they are come some what one were have from does put want give live'],
      ['Adding -s and -ing', 'cats dogs hats bugs ships helps jumps reads eating reading singing going fishing asking helping melting'],
    ] },
    { grade: 2, name: '2nd grade', patterns: [
      ['Long a: ai, ay', 'train paint wait tail mail snail stay gray tray away spray chain brain may clay'],
      ['Long e: ee, ea', 'sleep street wheel queen sheep team beach dream clean leaf speak teach cheese three eat'],
      ['Long o: oa, ow', 'coat soap goat toast float snow grow show slow throw bowl own yellow window below'],
      ['Long i: igh, y, ie', 'night light bright high sigh sky fly try cry dry pie tie find kind child'],
      ['ar, er, ir, or, ur', 'car star park farm hard shark bird girl first shirt dirt burn turn nurse fur her fern corn horse storm short fork'],
      ['ou, ow, oi, oy', 'cloud round house mouth shout count cow down town brown owl crown boy toy coin oil point joy soil'],
      ['Adding -er and -est', 'taller tallest louder loudest smaller smallest longer longest older oldest colder coldest'],
      ['Adding -ed and -ing', 'jumped played looked wanted helped jumping playing looking sitting running hopped stopped liked baked riding'],
      ['Sound-alikes', 'to too two there their see sea be bee for four no know ate eight blue blew hear here'],
      ['Tricky words', 'because people friend could would should every very many any once other who laugh done goes animal together around'],
    ] },
    { grade: 3, name: '3rd grade', patterns: [
      ['Double letters', 'rabbit kitten happen little bottle button dinner letter summer puppy pretty follow middle pillow better apple hammer ladder carrot balloon'],
      ['Silent letters', 'knee knife knock kneel wrist wrong wrap lamb climb thumb comb ghost listen castle half island'],
      ['Plurals', 'boxes dishes lunches foxes buses babies cities stories berries families leaves wolves children mice teeth women geese knives'],
      ['-ful, -less, -ly, -ness', 'helpful careful hopeful thankful useless careless quickly slowly softly safely kindness sadness darkness sickness'],
      ['-y, -er and -est', 'sunny windy rainy cloudy funny happier happiest easier easiest sillier silliest heavier'],
      ['un- and re-', 'unhappy unlock untie unsafe redo reread retell rewrite refill replay'],
      ['Changing the ending', 'hopping hoping making taking smiling shopping planned clapped dropped tried cried hurried bigger biggest faster fastest'],
      ['Soft c and g, -dge, -tch', 'circle pencil dance face place gem giant page cage large bridge judge badge edge catch match watch kitchen itch orange village'],
      ['Sound-alikes', 'hour our right write meet meat week weak flower flour pair pear bear bare which witch sent cent'],
      ['Tricky words', 'although answer beautiful believe different enough favorite minute often special through thought caught built busy early heard already always'],
    ] },
    { grade: 4, name: '4th grade', patterns: [
      ['ough and augh', 'ought bought brought fought cough rough tough daughter taught laughed though dough'],
      ['-tion and -sion', 'action nation station motion question vacation addition fraction mention attention direction solution pollution collection information explanation invention vision television decision explosion'],
      ['-ture and -ous', 'picture nature future adventure creature furniture temperature famous nervous dangerous enormous curious'],
      ['Prefixes', 'disagree disappear dishonest mistake misspell misplace preview preheat overcome overnight underline underground'],
      ['-able, -ible, -ment', 'comfortable valuable possible terrible movement payment excitement argument enjoyment'],
      ['Compound words', 'basketball everything somebody afternoon grandmother homework sometimes without outside birthday classroom weekend notebook sunshine rainbow everywhere popcorn'],
      ['ie and ei', 'receive ceiling weigh field shield chief thief niece relief height either neither'],
      ['-ly, -ward and -ity', 'friendly suddenly finally lonely actually forward backward toward safety activity ability'],
      ['-le endings', 'table simple puzzle candle gentle purple eagle giggle tickle title'],
      ['Tricky plurals', 'tomatoes potatoes heroes halves shelves oxen deer moose'],
      ['Sound-alikes', 'whole hole weather whether peace piece plain plane break brake allowed aloud board bored waist waste'],
      ['Tricky words', 'probably surprise February Wednesday library across address among calendar certain describe during interesting instead important language machine neighbor ocean quiet quite straight usually'],
    ] },
    { grade: 5, name: '5th grade', patterns: [
      ['Greek and Latin roots', 'telephone photograph autograph biography geography microscope telescope thermometer transport portable construct structure inspect spectator audience dictionary predict visible'],
      ['-ence, -ance, -ent, -ant', 'difference confidence patience silence appearance distance importance entrance independent excellent magnificent elegant assistant pleasant ignorant'],
      ['-able and -ible', 'incredible responsible invisible flexible sensible available remarkable reasonable adorable believable'],
      ['Prefixes', 'international interrupt internet submarine subway semicircle supermarket superhero transform translate misbehave nonfiction nonsense impossible impatient irregular illegal'],
      ['-ious, -eous, -cial, -tial', 'delicious precious spacious gorgeous courageous official artificial partial essential confidential'],
      ['-ize, -ify and -ism', 'realize organize memorize apologize criticize simplify classify identify magnify heroism criticism'],
      ['Doubling before a suffix', 'committed forgotten occurred preferred referring controlled admitted regretted equipped beginner'],
      ['Silent letters', 'column autumn solemn doubt debt subtle wrestle whistle muscle scissors design yacht campaign'],
      ['Easily confused', 'principal principle stationary stationery affect effect accept except desert dessert compliment complement capital capitol cereal serial'],
      ['Tricky words', 'beginning business necessary separate definitely environment government immediately occasion recommend rhythm schedule science vegetable restaurant sincerely tomorrow truly unusual vacuum weird achieve apparent guarantee knowledge mischievous privilege conscious embarrass exaggerate foreign guard humorous jewelry lightning opportunity possession pronunciation recognize rehearse thorough twelfth'],
    ] },
  ]

  // Words that sound the same (or nearly), so the choices never offer the other one as "wrong".
  const HOMOPHONES = [
    'to too two', 'there their', 'see sea', 'be bee', 'for four', 'no know', 'ate eight', 'blue blew', 'hear here',
    'hour our', 'right write', 'meet meat', 'week weak', 'flower flour', 'pair pear', 'bear bare', 'which witch', 'sent cent scent',
    'whole hole', 'weather whether', 'peace piece', 'plain plane', 'break brake', 'allowed aloud', 'board bored', 'waist waste',
    'principal principle', 'stationary stationery', 'capital capitol', 'cereal serial', 'affect effect', 'accept except', 'desert dessert', 'compliment complement',
    'one won', 'some sum', 'sun son', 'would wood', 'night knight', 'made maid', 'tail tale', 'mail male', 'road rode', 'deer dear',
    'high hi', 'rain reign rein', 'fur fir', 'wait weight', 'through threw', 'heard herd', 'not knot', 'nose knows', 'beach beech',
    'wrap rap', 'feet feat', 'weigh way', 'by buy bye', 'new knew', 'its it\'s', 'red read', 'fourth forth', 'seed cede', 'knead need',
  ].map(g => g.split(' '))

  // "Use it in a sentence", for the words that need one to be sure which word it is.
  const SENTENCES = {
    to: 'We walk to school.', too: 'I want to come too.', two: 'I have two hands.',
    there: 'The park is over there.', their: 'The kids rode their bikes.',
    see: 'I can see the moon.', sea: 'Fish swim in the sea.', be: 'I will be home soon.', bee: 'A bee buzzed by the flowers.',
    for: 'This gift is for you.', four: 'A dog has four legs.', no: 'No, thank you.', know: 'I know the answer.',
    ate: 'We ate pizza for dinner.', eight: 'A spider has eight legs.', blue: 'The sky is blue.', blew: 'The wind blew the leaves.',
    hear: 'I can hear the birds.', here: 'Come over here.',
    hour: 'The movie is one hour long.', our: 'This is our house.', right: 'Turn right at the corner.', write: 'Please write your name.',
    meet: 'Nice to meet you.', meat: 'The dog ate the meat.', week: 'There are seven days in a week.', weak: 'The baby bird was weak.',
    flower: 'Maya picked a red flower.', flour: 'We need flour to bake bread.', pair: 'I got a new pair of shoes.', pear: 'A pear is a juicy fruit.',
    bear: 'The bear ate some honey.', bare: 'Leo walked on the sand in bare feet.', which: 'Which one do you want?', witch: 'The witch rode a broom.',
    sent: 'Sam sent a letter to Grandma.', cent: 'A penny is one cent.',
    whole: 'Alex ate the whole sandwich.', hole: 'The dog dug a hole.', weather: 'The weather is sunny today.', whether: 'I wonder whether it will rain.',
    peace: 'The lake was full of peace and quiet.', piece: 'Can I have a piece of cake?', plain: 'I like plain toast.', plane: 'The plane flew over the clouds.',
    break: 'Be careful not to break the glass.', brake: 'Press the brake to stop the bike.', allowed: 'Dogs are allowed in the park.', aloud: 'Please read the story aloud.',
    board: 'The teacher wrote on the board.', bored: 'I was bored on the long drive.', waist: 'The belt goes around your waist.', waste: 'Try not to waste water.',
    principal: 'The principal visited our class.', principle: 'Telling the truth is an important principle.',
    stationary: 'The bus stayed stationary at the red light.', stationery: 'Maya wrote a note on her new stationery.',
    affect: 'Rain can affect our plans.', effect: 'The medicine had a good effect.', accept: 'I accept your invitation.', except: 'Everyone came except Leo.',
    desert: 'A cactus grows in the desert.', dessert: 'We had ice cream for dessert.',
    compliment: 'Sam gave Alex a nice compliment.', complement: 'The red scarf is a nice complement to the coat.',
    capital: 'Washington, D.C. is the capital of the United States.', capitol: 'Lawmakers meet in the capitol building.',
    cereal: 'I eat cereal for breakfast.', serial: 'Every laptop has a serial number.',
    one: 'I have one brother.', some: 'Can I have some juice?', sun: 'The sun is hot.', would: 'Would you like a snack?',
    night: 'The stars come out at night.', made: 'Leo made a card for Mom.', tail: 'The dog wagged its tail.', mail: 'We got a letter in the mail.',
    road: 'The car drove down the road.', deer: 'A deer ran into the woods.', high: 'The kite flew high in the sky.', rain: 'Take an umbrella for the rain.',
    fur: 'The cat has soft fur.', wait: 'Please wait for me.', through: 'We walked through the woods.', heard: 'I heard a loud noise.',
    not: 'It is not time for bed.', nose: 'I smell with my nose.', beach: 'We built a sandcastle at the beach.', wrap: 'Let\'s wrap the present.',
    feet: 'I put socks on my feet.', weigh: 'How much do you weigh?', red: 'Stop at the red light.', seed: 'We planted a seed in the garden.',
  }

  /** Every bank word with where it lives: [{ w, grade, pattern }]. */
  const all = () => BANKS.flatMap(b => b.patterns.flatMap(([pattern, words]) => words.split(' ').map(w => ({ w, grade: b.grade, pattern }))))
  /** The other words that sound like this one. */
  const soundsLike = w => (HOMOPHONES.find(g => g.includes(w.toLowerCase())) || []).filter(x => x !== w.toLowerCase())

  const api = { BANKS, HOMOPHONES, SENTENCES, all, soundsLike }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.Banks = api
})(this)
