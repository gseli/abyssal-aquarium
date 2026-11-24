/* ============================================================
   ACUARIO ABISAL — textos en inglés (la versión principal)
   El juego se escribe en español; aquí está su traducción.
   · ui: clave = el texto español exacto que pasa por tr() o que
     está en index.html (que se escribe en inglés). {x} = variable.
   · especies / biomas / momentos: se superponen a SPECIES, BIOMES
     y MOMENTOS al elegir inglés (idioma.js).
   Tono: el mismo deadpan Katamari del original, no una traducción
   literal. Cargar antes que idioma.js.
   ============================================================ */
'use strict';

const INGLES = {
  ui: {
    // documento
    'Acuario Abisal — criaturas reales & ficticias': 'Abyssal Aquarium — real & fictional creatures',
    'Idioma': 'Language',

    // pantalla de inicio
    'EXPEDICIÓN Nº7': 'EXPEDITION No. 7',
    'ACUARIO': 'ABYSSAL',
    'ABISAL': 'AQUARIUM',
    'CRIATURAS REALES · & · FICTICIAS': 'REAL · & · FICTIONAL CREATURES',
    '✦ DESCUBRIMIENTO': '✦ DISCOVERY',
    'Observa, fotografía y completa el álbum. Las especies llegan solas — y algunas tienen sus condiciones.':
      'Observe, photograph and complete the album. Species arrive on their own — and some of them have conditions.',
    '◉ ACUARIO': '◉ AQUARIUM',
    'Tu pecera libre: solo las especies ya descubiertas, las que tú elijas. Sin retos; la cámara queda de recuerdo.':
      'Your own free tank: only species you’ve already discovered, whichever you like. No challenges; the camera is just for keepsakes.',
    'reiniciar expedición': 'restart expedition',
    '¿seguro? se borrará todo el álbum': 'sure? the whole album will be erased',
    'ÁLBUM {seen}/{total} · CONTINUAR': 'ALBUM {seen}/{total} · CONTINUE',
    'NUEVA EXPEDICIÓN': 'NEW EXPEDITION',
    '{n} ESPECIES DISPONIBLES': '{n} SPECIES AVAILABLE',
    'AÚN SIN ESPECIES — DESCUBRE PRIMERO': 'NO SPECIES YET — DISCOVER SOME FIRST',

    // HUD
    'Volver al inicio': 'Back to the start screen',
    'Inicio': 'Home',
    'INICIO': 'HOME',
    'Abrir bitácora': 'Open logbook',
    'Bitácora': 'Logbook',
    'BITÁCORA': 'LOGBOOK',
    'Abrir álbum': 'Open album',
    'Álbum': 'Album',
    'ÁLBUM': 'ALBUM',
    'Modo cámara': 'Camera mode',
    'Cámara (C)': 'Camera (C)',
    'CÁMARA': 'CAMERA',
    'Silenciar sonido': 'Mute sound',
    'Sonido': 'Sound',
    'SONIDO': 'SOUND',
    'MUDO': 'MUTED',
    'PROFUNDIDAD': 'DEPTH',
    'Ascender de ecosistema': 'Rise to the previous ecosystem',
    'Descender de ecosistema': 'Descend to the next ecosystem',
    'MODO ACUARIO · PECERA LIBRE': 'AQUARIUM MODE · FREE TANK',
    'MODO DESCUBRIMIENTO': 'DISCOVERY MODE',

    // pistas
    'Gestiona tus especies en la bitácora&nbsp;·&nbsp;elige cebo abajo&nbsp;·&nbsp;la cámara (<b>C</b>) es para el recuerdo':
      'Manage your species in the logbook&nbsp;·&nbsp;pick bait below&nbsp;·&nbsp;the camera (<b>C</b>) is for keepsakes',
    'Observa para registrar&nbsp;·&nbsp;pulsa <b>C</b> para fotografiar&nbsp;·&nbsp;toca el agua para dar de comer<br>Y quédate un rato: algunas cosas solo pasan si hay alguien mirando.':
      'Watch to log&nbsp;·&nbsp;press <b>C</b> to photograph&nbsp;·&nbsp;tap the water to feed<br>And stay a while: some things only happen when someone is watching.',

    // viaje entre biomas
    'DESCENDIENDO': 'DESCENDING',
    'ASCENDIENDO': 'RISING',
    'Descender a {bioma}': 'Descend to {bioma}',
    'No hay nada más abajo. Todavía.': 'There is nothing further down. Yet.',
    'Para descender: {piden} especies registradas aquí. Llevas {van}.': 'To descend: {piden} species logged here. You have {van}.',
    'Se registran en modo Descubrimiento.': 'Species are logged in Discovery mode.',

    // cámara
    'REC · EXPEDICIÓN Nº7': 'REC · EXPEDITION No. 7',

    // álbum
    'Álbum de la expedición': 'Expedition album',
    'ESPECIES': 'SPECIES',
    'MOMENTOS': 'MOMENTS',
    'Cerrar álbum': 'Close album',
    'Elige una entrada del álbum.': 'Pick an entry from the album.',
    '{seen} registradas · {shot} fotografiadas · {total} en total': '{seen} logged · {shot} photographed · {total} in all',
    '{hechos} de {total} momentos · se fotografían mientras ocurren': '{hechos} of {total} moments · photograph them while they happen',
    '✦ COMPLETA': '✦ COMPLETE',
    'SIN FOTOGRAFIAR': 'NOT PHOTOGRAPHED',
    'NO REGISTRADA': 'NOT LOGGED',
    'TU FOTO · EXPEDICIÓN Nº7': 'YOUR PHOTO · EXPEDITION No. 7',
    'Foto de {nombre}': 'Photo of {nombre}',
    'PARA CURIOSOS': 'FOR THE CURIOUS',
    'Entrada incompleta. Fotografíala (tecla C) para que la expedición redacte su informe.':
      'Incomplete entry. Photograph it (C key) so the expedition can write up its report.',
    'Tu foto: {nombre}': 'Your photo: {nombre}',
    'LO PROVOCAS': 'YOU CAUSE IT',
    'OCURRE SOLO': 'HAPPENS ON ITS OWN',
    'MÁS ABAJO': 'FURTHER DOWN',
    'Este ecosistema todavía no te conoce. Baja primero y luego hablamos.':
      'This ecosystem doesn’t know you yet. Come down first and then we’ll talk.',

    // bitácora
    'Bitácora de expedición': 'Expedition logbook',
    'Cerrar panel': 'Close panel',
    'EXPEDICIÓN Nº7 · v0.9': 'EXPEDITION No. 7 · v0.9',
    'ESPECIES REALES': 'REAL SPECIES',
    'ESPECIES FICTICIAS': 'FICTIONAL SPECIES',
    'EXPEDICIÓN': 'EXPEDITION',
    'AMBIENTE': 'AMBIENCE',
    'Modo abisal': 'Abyss mode',
    'Quitar {nombre}': 'Remove {nombre}',
    'Añadir {nombre}': 'Add {nombre}',
    'POBLACIÓN: {n}': 'POPULATION: {n}',

    // ficha
    'REAL': 'REAL',
    'FICTICIO': 'FICTIONAL',
    'Seguir a la criatura': 'Follow the creature',
    '◉ SEGUIR': '◉ FOLLOW',
    'Cerrar ficha': 'Close card',
    'TAMAÑO': 'SIZE',
    'DIETA': 'DIET',
    'Entrada sin fotografiar. Pulsa C, enfócala y dispara: la expedición completará su informe en el álbum.':
      'Not photographed yet. Press C, frame it and shoot: the expedition will finish its report in the album.',
    '◉ SIGUIENDO:': '◉ FOLLOWING:',
    '· ESC o doble clic para soltar': '· ESC or double-click to let go',

    // cebos
    'CEBO': 'BAIT',
    'PLANCTON': 'PLANKTON',
    'PELLETS': 'PELLETS',
    'CARNADA': 'CHUM',
    'LUZ': 'LIGHT',

    // avisos
    '✦ Especie registrada — {nombre}': '✦ Species logged — {nombre}',
    '✧ Bitácora completa. La expedición Nº7 hace historia.': '✧ Logbook complete. Expedition No. 7 makes history.',
    '✧ Nuevo ecosistema al alcance: {bioma}. Usa la flecha ▸ de arriba.': '✧ New ecosystem within reach: {bioma}. Use the ▸ arrow up top.',
    '◉ Entrada completa en el álbum — {nombre}': '◉ Album entry complete — {nombre}',
    '◉ Foto actualizada — {nombre}': '◉ Photo updated — {nombre}',
    '✧ Álbum fotográfico completo. Nadie te lo pidió y aun así lo hiciste.': '✧ Photo album complete. Nobody asked you to, and you did it anyway.',
    '❋ Momento en el álbum — {nombre}': '❋ Moment in the album — {nombre}',
    '❋ Momento actualizado — {nombre}': '❋ Moment updated — {nombre}',
    '✧ Los diez momentos. Has mirado de verdad. No se lo digas a nadie.': '✧ All ten moments. You really looked. Don’t tell anyone.',
    '◉ Solo agua. Bonita, eso sí.': '◉ Just water. Lovely water, though.',
  },

  biomas: {
    arrecife: 'THE REEF',
    burbujeante: 'THE FIZZING SEA',
    abismo: 'THE ABYSS',
    naufragio: 'THE WRECK',
    imposible: 'THE IMPOSSIBLE GARDEN',
  },

  especies: {
    /* ---------- reales · arrecife ---------- */
    blanco: {
      nombre: 'Great white shark',
      fact: 'Ah, the great white. Six meters of muscle and determination dedicated to never once catching a sardine. We are deeply moved. Keep at it, champ.',
      curioso: 'It can detect a drop of blood in 100 liters of water and senses the electric fields of its prey with organs called ampullae of Lorenzini. It can also leap clean out of the water. Here it has decided not to, for now.',
      dieta: 'Sardines (in theory)',
    },
    martillo: {
      nombre: 'Great hammerhead',
      fact: 'We put its eyes as far apart as they would go, just to see. Now it sees absolutely everything and keeps none of it to itself. We will not be taking questions about the process.',
      curioso: 'Its T-shaped head (the cephalofoil) gives it nearly 360° vision and works as a biological metal detector: it finds stingrays buried in the sand by following their electric field.',
      dieta: 'Rays and fish',
    },
    puntasblancas: {
      nombre: 'Whitetip reef shark',
      fact: 'The only shark in this aquarium that worked out you don’t have to swim nonstop to breathe. It lies down on the bottom and rests. The other sharks will never forgive it.',
      curioso: 'It really does rest: it actively pumps water over its gills, so it can lie still in caves for hours. It hunts at night, nosing into crevices where nobody else fits.',
      dieta: 'Crevice fish',
    },
    morena: {
      nombre: 'Green moray',
      fact: 'It looks green. It is brown, with a coat of yellow mucus on top. It has gone decades without correcting the misunderstanding because it could not care less. Respect.',
      curioso: 'It has a second set of jaws inside its throat (the pharyngeal jaws) that it shoots forward to drag prey in. Yes, like in Alien. It opens and closes its mouth only to breathe; the menace comes free of charge.',
      dieta: 'Fish and octopus',
    },
    cinta: {
      nombre: 'Ribbon eel',
      fact: 'It starts out black, turns electric blue, ends up yellow, and changes sex along the way. A commitment to personal reinvention your favorite artists can only dream of.',
      curioso: 'It is real, however unlikely it looks: a protandric hermaphrodite — every male (blue) eventually becomes a female (yellow). The flaps on its snout help it pick up vibrations.',
      dieta: 'Small fish',
    },
    electrica: {
      nombre: 'Electric eel',
      fact: 'Strictly speaking it isn’t an eel, and it doesn’t need to be: it’s an electric knife with opinions. 860 volts of opinions. Click on it to hear them.',
      curioso: 'It’s a knifefish (Gymnotiformes), a relative of the fish that “see” with electricity. It uses weak pulses as radar and strong shocks to hunt. And yes: it can leap out of the water to shock a threat. It’s documented.',
      prof: 'Rivers, 0–3 m', dieta: 'Stunned fish',
    },
    sardina: {
      nombre: 'Emerald sardine',
      fact: 'Forty sardines swimming in formation to look like one big fish. It doesn’t work. It has never worked. That they keep trying with such enthusiasm strikes us as beautiful.',
      curioso: 'The school has no leader: each sardine reacts only to its nearest neighbors, and the whole choreography emerges from those simple rules. Mathematicians are still taking notes.',
      dieta: 'Plankton',
    },
    payaso: {
      nombre: 'Clownfish',
      fact: 'It lives inside a stinging animal and calls it home. That’s the reef housing market for you. Bring your cursor close and watch how fast it runs back to its anemone.',
      curioso: 'A layer of mucus makes it immune to the anemone’s venom: it gets shelter, the anemone gets cleaning and defense. And like the ribbon eel, it changes sex: the dominant male becomes the female if the female goes missing.',
      dieta: 'Algae and plankton',
    },
    pulpo: {
      nombre: 'Reef octopus',
      fact: 'Three hearts, blue blood, nine brains, and it still hides from you. Draw your own conclusions. Hold still and it might go back to its real color.',
      curioso: 'It changes color and texture in under a second using cells called chromatophores — and it is colorblind, which is the truly baffling part. Two thirds of its neurons are in its arms: each arm thinks a little for itself.',
      tam: '80 cm (arms incl.)', dieta: 'Crabs',
    },
    raya: {
      nombre: 'Common stingray',
      fact: 'It flies without ever leaving the floor. Strictly horizontal elegance. The leviathan claims it copied its style; we will neither confirm nor deny.',
      curioso: 'It swims by rippling the edges of its disc like a flag, and spends the day buried in the sand with only its eyes showing. The barb on its tail is purely defensive: it never uses it unless stepped on.',
      tam: '1–1.4 m across', dieta: 'Buried mollusks',
    },
    medusa: {
      nombre: 'Moon jellyfish',
      fact: 'It has been drifting since before the dinosaurs, with no brain, no blood and no hurry. It has survived five mass extinctions by doing exactly nothing. Take notes.',
      curioso: 'Its lineage has been in the oceans for more than 500 million years. It is 95% water and digests through the same opening it eats with, a detail we would rather not expand on.',
      dieta: 'Plankton',
    },
    estrella: {
      nombre: 'Common starfish',
      fact: 'No brain, no blood, no excuses. Pull off an arm and it makes another one. You complain about Mondays. We’ll say no more.',
      curioso: 'To eat, it pushes its stomach out of its body, wraps it around the prey and digests it right there. Some species can regrow an entire body from a single arm.',
      dieta: 'Mollusks',
    },
    ermitano: {
      nombre: 'Hermit crab',
      fact: 'It lives in shells inherited from mollusks that no longer needed them. The circular economy, with claws. Get too close and it shuts the door. Understandable.',
      curioso: 'When a good shell comes free, hermit crabs line up by size and swap houses in a chain, all at once. It’s called a “vacancy chain” and economists study it in earnest.',
      dieta: 'Leftovers (doesn’t ask)',
    },

    /* ---------- reales · mar burbujeante ---------- */
    jardin: {
      nombre: 'Garden eel',
      fact: 'A colony of question marks poking out of the sand. They hide when you come close and pop back up when you leave. Shyness, in lawn form.',
      curioso: 'They’re real: they live in colonies of hundreds, each in its own burrow for life, eating whatever plankton drifts past. They bend with the current exactly like grass in the wind.',
      dieta: 'Passing plankton',
    },
    caballito: {
      nombre: 'Seahorse',
      fact: 'Prehensile tail, pregnant dad, zero hurry. The only fish that swims upright, presumably because it seemed more dignified.',
      curioso: 'The male carries the young in his belly pouch: the pregnancy is his. And they swim so badly they rank among the slowest fish in the world — the dwarf seahorse covers about a meter and a half an hour.',
      dieta: 'Copepods',
    },
    globo: {
      nombre: 'Pufferfish',
      fact: 'Its defense plan is to become a geometry problem: from fish to spiky sphere in one second. Bring your cursor close and you’ll see. Afterwards it will pretend nothing happened.',
      curioso: 'It gulps water to triple its volume. The tetrodotoxin in its organs is hundreds of times deadlier than cyanide, and yet in Japan it is a delicacy (fugu) that only licensed chefs may prepare.',
      dieta: 'Mollusks and urchins',
    },
    tortuga: {
      nombre: 'Green sea turtle',
      fact: 'It has been making the same journey with the same calm for 110 million years. The leviathan respects it. So do we. You should too.',
      curioso: 'It returns to lay its eggs on the exact beach where it hatched, finding its way by Earth’s magnetic field. Asleep, it can go hours without coming up to breathe.',
      dieta: 'Algae and jellyfish',
    },

    /* ---------- reales · abismo ---------- */
    rape: {
      nombre: 'Deep-sea anglerfish',
      fact: 'It’s what the lightkeeper sees in its nightmares. Nature had the same idea we did, just without the affection.',
      curioso: 'Its lure glows thanks to symbiotic bacteria. And the male is so small that he lives fused to the female like an appendage: he literally becomes part of her. The abyss shows no mercy to romantics.',
      tam: '18 cm (the female)', dieta: 'Whatever fits',
    },
    pelicano: {
      nombre: 'Pelican eel',
      fact: 'A mouth with an eel attached. It swallows things its own size because, at that depth, nobody has ever told it no.',
      curioso: 'Its mouth takes up a quarter of its body, and it carries a glowing red photophore on the tip of its tail — probably a lure, though who knows. So few have been filmed that every sighting makes the news.',
      dieta: 'Surprises',
    },
    linterna: {
      nombre: 'Lanternshark',
      fact: 'A pocket-sized shark that glows from underneath. In total darkness, being invisible from below is the smart move. The big sharks take notes; it won’t lend them out.',
      curioso: 'It’s called counterillumination: the photophores on its belly mimic the faint light coming down from above, erasing its silhouette for anyone looking up. Its cousin, the dwarf lanternshark, fits in your hand.',
      dieta: 'Krill and squid',
    },
    vampiro: {
      nombre: 'Vampire squid',
      fact: 'Neither a squid, nor a vampire, nor from hell, whatever its scientific name says. When something scares it, it wraps itself in its own cloak — which is exactly what any of us would do.',
      curioso: 'It lives where there is almost no oxygen and doesn’t even hunt: it eats marine snow, the drizzle of scraps that falls from the world above. Relative to its body, its eyes are among the largest in the animal kingdom.',
      dieta: 'Marine snow',
    },
    hacha: {
      nombre: 'Hatchetfish',
      fact: 'A silver hatchet with a permanently worried face. It is always looking up, waiting for something that never quite comes down.',
      curioso: 'Its tubular eyes point skyward to catch silhouettes against the light, and the photophores on its belly erase it for anyone searching from below. The whole abyss plays the same game of vertical hide-and-seek.',
      dieta: 'Plankton',
    },

    /* ---------- reales · naufragio ---------- */
    congrio: {
      nombre: 'Conger eel',
      fact: 'The moray has a cousin from up north: grayer, more serious, and just as unwilling to leave its pipe. It has guarded the breach in the hull for a century. Nobody asked it to. That’s precisely why.',
      curioso: 'Real congers spend years in the same hole in a wreck and grow past two meters. As youngsters they are transparent larvae (leptocephali) that drift across the ocean before choosing their hole forever.',
      dieta: 'Whatever passes its door',
    },
    mero: {
      nombre: 'Goliath grouper',
      fact: 'The size of a fridge, with the face of someone about to tell you something. It never does. The ship is its; you’re just visiting, and you know it.',
      curioso: 'The real goliath grouper grows past 2.5 meters and 400 kilos, and booms with its swim bladder (BOOM!) to mark its territory. It nearly went extinct from overconfidence: it never fled from anyone.',
      dieta: 'Crustaceans (whole)',
    },
    jureles: {
      nombre: 'Wreck trevally',
      fact: 'They have been circling the mast since before anyone can remember. Maybe they’re waiting for orders. Maybe they are the orders.',
      curioso: 'Trevally tornadoes around wrecks are real and can reach thousands of fish. Nobody fully knows why they orbit sunken structures; the theories range from protection to sheer enjoyment.',
      dieta: 'Smaller fish',
    },
    dumbo: {
      nombre: 'Dumbo octopus',
      fact: 'An octopus with ears that flaps instead of swimming. The abyss has a tender side too; it has trouble admitting it, but here is the proof.',
      curioso: 'Grimpoteuthis is the deepest-living octopus known: it has been seen at 7,000 meters. It swims by flapping its ear-like fins — yes, exactly like the elephant in the movie, but in a version that actually works.',
      dieta: 'Worms and copepods',
    },

    /* ---------- ficticios ---------- */
    espectro: {
      nombre: 'Specter shark',
      fact: 'It doesn’t show up when you look for it. It shows up when you give up. That is its only trick, and it wields it with admirable cruelty. Leave your cursor still for a while and we’ll see.',
      curioso: 'The data in this entry could not be verified by anyone who was looking at the time. Expedition No. 4 claimed to have photographed it; the photo came out blurry. No. 5 never spoke of it again.',
      tam: '5–7 m (estimated)', prof: 'Unknown', dieta: 'Other people’s memories',
    },
    neon: {
      nombre: 'Neon eel',
      fact: 'It swallowed the last light in the abyss when it was little and has been paying it back in installments ever since. Generous, in its way. In abyss mode it really shows off.',
      curioso: 'Its glow isn’t bioluminescence but, in its own words, “secondhand light in perfect condition.” No instrument on the expedition has managed to measure it without getting sentimental.',
      dieta: 'Photons',
    },
    faroluz: {
      nombre: 'Lightkeeper',
      fact: 'It has spent centuries reading the seabed by the light of its lantern. It hasn’t found anything. This doesn’t seem to bother it. There’s a lesson in there, but we’re not going to spoon-feed it to you.',
      curioso: 'The lantern runs on a seemingly bottomless reserve of patience. When two lightkeepers cross paths, they dim their lights as a sign of respect. Nobody taught them to.',
      dieta: 'Whatever you toss in',
    },
    espejo: {
      nombre: 'Mirror fish',
      fact: 'It reflects the color of whatever is closest, especially if it’s scared of it. If you get too close and see something horrible, we apologize for the inconvenience: it’s the mirror, not you. Probably.',
      curioso: 'Expedition No. 2 tried to catalog it by placing it in front of another mirror fish. The resulting report runs to 400 pages and concludes nothing. Both fish seemed satisfied.',
      dieta: 'Appearances',
    },
    sacacorchos: {
      nombre: 'Corkscrew eel',
      fact: 'It swims in a spiral because it worked out once and it never figured out how to stop. It opens sunken bottles out of sheer politeness.',
      curioso: 'Expedition No. 3 used it to uncork a champagne from the 1912 wreck. It fizzed perfectly. The official report describes it as “tool and friend.”',
      dieta: 'Corks (allegedly)',
    },
    copa: {
      nombre: 'Goblet fish',
      fact: 'It drinks bubbles and keeps them inside. When it’s full, it floats upward with the dignity of someone who planned absolutely none of this.',
      curioso: 'Its internal fizz level is visible to the naked eye. The expedition is still voting on whether it is a fish or a glass with opinions. The last vote was a tie; the goblet fish abstained.',
      dieta: 'Bubbles',
    },
    sifon: {
      nombre: 'Siphon jellyfish',
      fact: 'A jellyfish made of gas with balloon ambitions. It rises, bursts into bubbles, reassembles on the bottom and tries again. Sisyphus, but buoyant and cheerful.',
      curioso: 'Nobody knows whether it bursts by accident or for fun. The expedition stopped counting its attempts at number 4,048. It hasn’t stopped counting.',
      dieta: 'Dissolved air',
    },
    constelacion: {
      nombre: 'Constellation fish',
      fact: 'It isn’t a fish: it’s the gap where a fish used to be, marked out in stars. Now and then it joins them up, in case you’d like to read it. Nobody has managed it twice.',
      curioso: 'Each specimen draws a different constellation and keeps it for life. The expedition catalogued 61 patterns; number 62 turned out to be a map of the expedition itself. It was decided to stop counting.',
      tam: 'Indeterminable', dieta: 'Leftover darkness',
    },
    carbon: {
      nombre: 'Charcoal shark',
      fact: 'Darker than the water around it. It doesn’t reflect light: it keeps it. Stare at it for a while and it stares back.',
      curioso: 'The instruments log it as a measurement error with fins. It chases bottled light, which suggests hunger or nostalgia; the expedition has preferred not to find out which.',
      tam: '4 m (by elimination)', prof: 'Wherever you aren’t looking', dieta: 'Light',
    },
    vigia: {
      nombre: 'The Lookout',
      fact: 'It climbed up to the crow’s nest in 1912 to stand its watch. The ship sank; the watch didn’t. It is looking at you right now. And now, too.',
      curioso: 'Its eye follows visitors with one hundred percent accuracy. The expedition organized shifts to try to bore it. They got bored first, in 1988. It’s still going.',
      tam: 'One eye', prof: 'The crow’s nest', dieta: 'Horizons',
    },
    moneda: {
      nombre: 'Coin fish',
      fact: 'The ship’s treasure learned to swim. When anything comes near, it hurries back to the chest: a coin’s deepest instinct is not to be spent.',
      curioso: 'Every coin fish has a heads and a tails. The expedition tossed one a hundred times: all hundred times, it swam away. Statistically flawless.',
      tam: '3 cm across', prof: 'The chest', dieta: 'Interest',
    },
    campana: {
      nombre: 'Bronze jellyfish',
      fact: 'The ship’s bell decided to keep working on its own. Touch it and it rings — the water keeps the sound of the metal and lets only the ripple through. It tells the time in a time zone that no longer exists.',
      curioso: 'It strikes eight bells at the end of every watch, as naval tradition demands. That there have been no watches since 1912 is none of its business.',
      tam: '33 cm of bronze', prof: 'Beside its ship', dieta: 'Hours, on the hour',
    },
    semilla: {
      nombre: 'Seed fish',
      fact: 'It swims until it finds a spot it likes, plants itself and sprouts into a coral flower. The flower releases more seed fish. The whole garden is this one fish not knowing when to stop.',
      curioso: 'The expedition tried to take one back as a sample. It planted itself in a uniform pocket. The uniform blossomed. It is now official policy not to have pockets.',
      tam: '4 cm (fish stage)', dieta: 'Patience',
    },
    raiz: {
      nombre: 'Root eel',
      fact: 'It lives half-buried, connecting the flowers from underneath. Nobody knows what it tells them. The flowers along its path grow better, so it must be something.',
      curioso: 'It has wooden knots and a bud on its forehead that never quite opens. The expedition wishes it all the best. Quietly, so as not to pressure it.',
      tam: '2 m (the visible part)', dieta: 'Minerals and gossip',
    },
    flor: {
      nombre: 'Flower shark',
      fact: 'An apex predator with a dorsal corolla. It sheds petals as it swims and hunts nothing: it pollinates. The garden’s food chain is, technically, a bouquet.',
      curioso: 'Its petals grow back every night. The expedition pressed one in the logbook; the logbook smells of sea and birthdays. Nobody has opened it since, for fear of spoiling it.',
      tam: '3 m with petals', dieta: 'Light (while pollinating)',
    },
    colibri: {
      nombre: 'Hummingbird fish',
      fact: 'It beats its fins eighty times a second to stay exactly where it already was. It sips from the coral flowers and, in return, tells them what lies beyond the garden. The flowers don’t believe it.',
      curioso: 'It is the only known fish that can swim backward, forward and nowhere. It prefers the third option.',
      dieta: 'Coral nectar',
    },
    diente: {
      nombre: 'Dandelion jellyfish',
      fact: 'Touch it and it comes apart in tufts. Make a wish if you like; it puts itself back together exactly the same, with the serenity of someone who already made theirs and got it.',
      curioso: 'The expedition blew on one and counted the tufts that came back: all of them. They always all come back. The report calls this “deeply reassuring, for reasons we would rather not analyze.”',
      tam: '5 cm (spherical)', dieta: 'Other people’s wishes',
    },

    /* ---------- expedición ---------- */
    buzo: {
      nombre: 'Explorer diver',
      fact: 'Homo sapiens with a tank. Three dives looking for the specter shark. The specter shark has been writing reports on him since the second. Neither of them knows.',
      curioso: 'From his logbook: “Day 47. The sardines say hello now. The moray still doesn’t. The sandwich budget has been exhausted since day 12.”',
      prof: 'As deep as it goes', dieta: 'Sandwiches (topside)',
    },
  },

  momentos: {
    rastreo: {
      nombre: 'The metal detector',
      pista: 'Something with a T-shaped head is sweeping the sand. The sand is pretending there’s nobody underneath. Don’t do anything: it’s what you do best.',
      relato: 'The hammerhead found the ray by its electric field, uncovered it and swam off without eating it. It just wanted the ray to know that it knew. Was that really necessary.',
    },
    saludo: {
      nombre: 'Lantern etiquette',
      pista: 'Those who live by their lantern know their manners. Bottle a little light, leave it nearby and don’t interrupt.',
      relato: 'They crossed paths, dimmed their lights and bowed. Nobody taught them to. Somebody taught you, and look.',
    },
    susto: {
      nombre: 'The wave of shyness',
      pista: 'A sphere with self-esteem issues is strolling over a very nervous lawn. Wait. It’s contagious.',
      relato: 'The puffer got scared of them, they got scared that it got scared, and the whole meadow hid in order of proximity. There was no danger at all. Lovely.',
    },
    baile: {
      nombre: 'Choreography for lawn',
      pista: 'The question marks agree on only one thing: dinner. Serve it right on top of them.',
      relato: 'A whole colony moving as one for a handful of plankton. They have rehearsed all their lives, each in its own hole, without ever seeing each other.',
    },
    contraluz: {
      nombre: 'Vertical hide-and-seek',
      pista: 'One lives looking up. The other lives by not being seen from below. Sooner or later they meet.',
      relato: 'The hatchetfish looked right where the shark was and saw lit water. The shark went by being lit water. They both count it as a win.',
    },
    mapa: {
      nombre: 'Map number 62',
      pista: 'Loose stars don’t lead anywhere. Give them a light for reference and see what they draw.',
      relato: 'They joined up their dots and out came the map of this expedition, with a mark where you are. It has been decided not to ask any more questions.',
    },
    retumbo: {
      nombre: 'Right of way',
      pista: 'The owner of the ship has something to say, and there’s a tornado of fish in the middle of the hallway. Don’t even think about stepping in.',
      relato: 'BOOM! It said it with its swim bladder, which is how important things get said. The tornado opened a hallway. Nobody argued.',
    },
    guardia: {
      nombre: 'Changing of the watch',
      pista: 'There’s an employee made of bronze who can count to eight. Somebody should ask her, with a finger.',
      relato: 'Eight bells, and the whole ship turned up, as at every watch since 1912. There was no relief. There’s never any relief. They came anyway.',
    },
    polinizacion: {
      nombre: 'Apex predator at work',
      pista: 'The most fearsome animal in the garden has its rounds to make. Watch the flowers as it passes. Just watch.',
      relato: 'It swept low and every flower opened all the way, one after another. The food chain is working again and nobody had to die.',
    },
    siembra: {
      nombre: 'Make a wish',
      pista: 'There’s something made entirely of other people’s wishes. One finger is enough to undo it. Then watch where it lands.',
      relato: 'The tufts that didn’t come back were seeds after all. Where each one fell, there’s a flower. Yours fell too. We won’t say where.',
    },
  },
};
