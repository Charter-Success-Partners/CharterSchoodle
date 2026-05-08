import fs from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const schoolsPath = path.join(rootDir, "data", "schools.json");
const clueBankPath = path.join(rootDir, "data", "clue-bank-statewide.json");
const outputPath = path.join(rootDir, "data", "clue-bank-batch-034.json");

const COMMON_NAME_WORDS = new Set([
  "academy",
  "school",
  "charter",
  "community",
  "public",
  "leadership",
  "classical",
  "preparatory",
  "prep",
  "arts",
  "art",
  "science",
  "math",
  "technology",
  "digital",
  "visual",
  "international",
  "studies",
  "schools",
  "and",
  "the",
  "of",
  "for",
  "at",
  "in",
  "north",
  "piedmont",
  "carolina",
  "high",
  "middle",
  "elementary",
  "upper",
  "primary",
  "advtech",
  "stream",
  "stem",
  "steam",
  "institute",
]);

const MANUAL_ENRICHMENTS = {
  "agape-achievement-academy": {
    sourceLinks: {
      home: "https://www.agapeachieveacademy.com/",
      vision: "https://www.agapeachieveacademy.com/our-vision",
      about: "https://www.agapeachieveacademy.com/about-us",
    },
    clues: [
      clue(
        "Its mission centers academic excellence, character building, and a love of learning through a rigorous, content-rich curriculum.",
        8,
        "mission",
        ["home", "vision"],
      ),
      clue(
        "Its vision stresses rigorous, culturally relevant learning paired with high academic and behavioral standards.",
        7,
        "vision",
        ["vision"],
      ),
      clue(
        "Its official site highlights small-group instruction in reading and math alongside project-based and service-learning opportunities.",
        6,
        "program",
        ["about"],
      ),
    ],
  },
  "alamance-community-school": {
    sourceLinks: {
      home: "https://www.alamancecommunityschool.net/",
    },
    clues: [
      clue(
        "Its mission is to help students become engaged citizens by exploring real-world problems and creating innovative solutions.",
        8,
        "mission",
        ["home"],
      ),
      clue(
        "Its academic model is built around project-based learning.",
        7,
        "model",
        ["home"],
      ),
      clue(
        "Its public-facing tagline is 'Find meaning, develop empathy, create solutions.'",
        6,
        "identity",
        ["home"],
      ),
    ],
  },
  "carter-g-woodson-school": {
    sourceLinks: {
      home: "https://www.cartergwoodsonschool.org/",
      studentLife: "https://www.cartergwoodsonschool.org/student-life",
      collegeReady: "https://www.cartergwoodsonschool.org/college-ready",
    },
    clues: [
      clue("Its school-wide motto is 'Strive to Excel, Not to Equal.'", 8, "identity", ["home"]),
      clue(
        "Its student-life program highlights poetry, visual arts, agriculture and food science, and mock trial leadership development.",
        7,
        "program",
        ["studentLife"],
      ),
      clue(
        "Its official site notes that students have traveled to East Africa for study and cultural immersion.",
        6,
        "program",
        ["studentLife"],
      ),
    ],
  },
  "crosscreek-charter-school": {
    sourceLinks: {
      home: "https://www.crosscreekcharterschool.com/",
      mission: "https://www.crosscreekcharterschool.com/about-us/mission-and-philosophy",
    },
    clues: [
      clue(
        "Its mission emphasizes empowering each student to reach their fullest potential as a lifelong learner.",
        8,
        "mission",
        ["mission"],
      ),
      clue(
        "Its philosophy describes the school as child-centered, family-oriented, and community-based.",
        7,
        "philosophy",
        ["mission"],
      ),
      clue(
        "Its official history says the school opened in August 2001 after local families envisioned a different kind of learning community.",
        6,
        "history",
        ["mission"],
      ),
    ],
  },
  "emereau-bladen": {
    sourceLinks: {
      home: "https://www.emereau.org/",
      about: "https://www.emereau.org/about",
      academics: "https://www.emereau.org/academics",
    },
    clues: [
      clue(
        "Its founding goal was 'graduation for all' children.",
        8,
        "mission",
        ["home", "about"],
      ),
      clue(
        "Its mission language moves through a sequence of verbs: illuminate, investigate, innovate, cultivate, celebrate.",
        7,
        "identity",
        ["home"],
      ),
      clue(
        "Its model includes a daily 'Illuminator' journal and an inquiry process tied to investigation, discovery, innovation, and transformation.",
        6,
        "program",
        ["about", "academics"],
      ),
    ],
  },
  "girls-leadership-academy-of-wilmington": {
    sourceLinks: {
      home: "https://www.glowacademy.net/",
      about: "https://glowacademy.net/about-us/",
      campus: "https://www.glowacademy.net/our_school/our_campus",
    },
    clues: [
      clue(
        "Its vision is summed up in a short phrase: 'She Will... Graduate, Go to College, Succeed in Life.'",
        8,
        "identity",
        ["home", "about"],
      ),
      clue(
        "Its model is described as 'whole girl education,' blending rigorous academics with intentional social-emotional learning.",
        7,
        "model",
        ["about", "home"],
      ),
      clue(
        "Its campus includes Founders Hall, a College Bound Office, a culinary lab, a STEM lab, and outdoor learning classrooms.",
        6,
        "campus",
        ["campus"],
      ),
    ],
  },
  "honor-prep": {
    sourceLinks: {
      home: "https://www.honorpreparatory.org/",
      about: "https://www.honorpreparatory.org/about",
    },
    clues: [
      clue(
        "Its approach highlights bilingual education, equity and inclusion, and strong community engagement.",
        8,
        "model",
        ["home"],
      ),
      clue(
        "Its public materials say it is preparing 'the leaders of tomorrow.'",
        7,
        "identity",
        ["about"],
      ),
      clue(
        "Its vision focuses on a nurturing environment where students can excel academically, socially, and emotionally.",
        6,
        "vision",
        ["about"],
      ),
    ],
  },
  "magellan-charter": {
    sourceLinks: {
      mission: "https://www.k12jobspot.com/School/69418/Overview",
      facility: "https://www.bobbitt.com/project/education-day-care/magellan-charter-school",
    },
    clues: [
      clue(
        "Its mission describes an academically focused opportunity for highly motivated students built around interactive and experiential learning.",
        7,
        "mission",
        ["mission"],
      ),
      clue(
        "A nautical theme has long been part of the school's identity, including in its facility design.",
        6,
        "identity",
        ["facility"],
      ),
    ],
  },
  "marjorie-williams-academy": {
    sourceLinks: {
      story: "https://www.crossnore.org/passion-purpose/",
      home: "http://www.williamsacademy.org/",
    },
    clues: [
      clue(
        "Its motto is 'Dream It, Believe It, Achieve It' followed by the declaration that failure is not an option.",
        8,
        "identity",
        ["story"],
      ),
      clue(
        "Its surrounding campus is used as an 'outdoor classroom,' including excursions to gather plants and creek critters.",
        7,
        "program",
        ["story"],
      ),
      clue(
        "Its school story emphasizes an emotionally supportive and engaging learning environment that empowers students to achieve their full potential.",
        6,
        "mission",
        ["story"],
      ),
    ],
  },
  "mountain-city-public-montessori": {
    sourceLinks: {
      home: "https://mountaincitypublic.org/",
      about: "https://mountaincitypublic.org/our-school/about/",
      method: "https://mountaincitypublic.org/academics/montessori-method/",
    },
    clues: [
      clue(
        "Its mission promises equitable access to a high-quality, relevant Montessori education that strengthens community.",
        8,
        "mission",
        ["home"],
      ),
      clue(
        "Its governance model is participatory, spreading leadership across roles rather than centering a single head of school.",
        7,
        "leadership",
        ["about"],
      ),
      clue(
        "Its Montessori model emphasizes multi-age classrooms, three-hour work periods, and hands-on materials that build executive-function skills.",
        6,
        "model",
        ["method"],
      ),
    ],
  },
  "nc-leadership-charter-academy": {
    sourceLinks: {
      home: "https://www.thencla.org/",
      honorRoll: "https://www.thencla.org/article/2692433",
      sports: "https://www.thencla.org/article/1200861",
    },
    clues: [
      clue(
        "Its tagline says it is 'Developing Tomorrow's Leaders, Today.'",
        7,
        "identity",
        ["sports"],
      ),
      clue(
        "Its recent public updates highlight repeated AP School Honor Roll recognition.",
        6,
        "achievement",
        ["honorRoll"],
      ),
      clue(
        "Its mascot identity is built around Falcons.",
        5,
        "identity",
        ["sports"],
      ),
    ],
  },
  "old-main-stream-academy": {
    sourceLinks: {
      home: "https://sites.google.com/view/omsacademy/home?authuser=0",
      about: "https://sites.google.com/view/omsacademy/about-our-school",
      faqs: "https://sites.google.com/view/omsacademy/about-our-school/faqs",
    },
    clues: [
      clue(
        "Its mission is to engage students in STREAM disciplines that prepare future leaders who are innovative, persistent, and self-determined.",
        8,
        "mission",
        ["about"],
      ),
      clue(
        "Its curriculum emphasizes place-based instruction and local learning opportunities tied to Robeson County.",
        7,
        "program",
        ["about"],
      ),
      clue(
        "Its public-facing identity repeats a three-word mantra: innovative, persistent, self-determined.",
        6,
        "identity",
        ["home", "faqs"],
      ),
    ],
  },
  "paul-r-brown-leadership-academy": {
    sourceLinks: {
      home: "https://www.paulrbrownleadership.com/",
      superintendent: "https://www.paulrbrownleadership.com/superintendent",
    },
    clues: [
      clue(
        "Its mission promises an academically rich program built around reading, communication, critical thinking, problem solving, work ethic, integrity, physical wellness, and leadership.",
        8,
        "mission",
        ["home"],
      ),
      clue(
        "Its students are consistently referred to as cadets in public-facing school materials.",
        7,
        "identity",
        ["home", "superintendent"],
      ),
      clue(
        "Its superintendent page describes it as the state's only public charter military school.",
        6,
        "identity",
        ["superintendent"],
      ),
    ],
  },
  "piedmont-classical-high-school": {
    sourceLinks: {
      home: "https://piedmontclassical.com/",
      mission: "https://piedmontclassical.com/m/pages/index.jsp?pREC_ID=854927&type=d&uREC_ID=451986",
    },
    clues: [
      clue(
        "Its guiding triad is 'Citizenship, Character, Scholarship.'",
        8,
        "identity",
        ["home"],
      ),
      clue(
        "Its mission says students are educated through a challenging, classically driven curriculum designed to prepare them for any endeavor.",
        7,
        "mission",
        ["mission"],
      ),
      clue(
        "Its homepage says 'Where Bobcats Roar & Soar!'",
        6,
        "identity",
        ["home"],
      ),
      clue(
        "Its homepage prominently highlights AP Capstone.",
        5,
        "program",
        ["home"],
      ),
    ],
  },
  "quest-academy": {
    sourceLinks: {
      home: "https://www.questcharter.org/",
    },
    clues: [
      clue(
        "Its mission pairs academic excellence with students' pursuit of individual talents outside the classroom.",
        8,
        "mission",
        ["home"],
      ),
      clue(
        "Its model is designed for motivated students engaged in high-intensity training in athletics or fine arts.",
        7,
        "model",
        ["home"],
      ),
      clue(
        "Its public examples of student success highlight pursuits such as wakeboarding, soccer, golf, and other high-level extracurricular training.",
        6,
        "program",
        ["home"],
      ),
    ],
  },
  "rise-southeast-raleigh-charter-school": {
    sourceLinks: {
      whoWeAre: "https://risese.org/es/who-we-are/",
    },
    clues: [
      clue(
        "Its public history includes a rename from PAVE Southeast Raleigh Charter School to its current identity.",
        8,
        "history",
        ["whoWeAre"],
      ),
      clue(
        "Its public milestone timeline notes a five-year charter renewal from the State Board of Education.",
        7,
        "history",
        ["whoWeAre"],
      ),
      clue(
        "Its model is built to offer a strong school option for the Southeast Raleigh community.",
        6,
        "community",
        ["whoWeAre"],
      ),
    ],
  },
  "riverside-leadership-academy": {
    sourceLinks: {
      home: "https://www.riversideleadershipacademy.org/",
      about: "https://www.riversideleadershipacademy.org/about",
      academics: "https://www.riversideleadershipacademy.org/academics",
    },
    clues: [
      clue(
        "Its mission combines project-based learning and leadership curricula to develop confident, community-focused, future-ready leaders.",
        8,
        "mission",
        ["about"],
      ),
      clue(
        "Its public-facing slogan is 'Leading the quest for student success.'",
        7,
        "identity",
        ["home"],
      ),
      clue(
        "Its official academic description pairs project-based learning with Science of Reading and social-emotional learning.",
        6,
        "program",
        ["academics"],
      ),
    ],
  },
  "southeastern-academy": {
    sourceLinks: {
      home: "https://www.southeasternacademy.org/",
      about: "https://www.southeasternacademy.org/about-us",
      contact: "https://www.southeasternacademy.org/contact-us",
    },
    clues: [
      clue(
        "Its public-facing identity describes the school as 'a diverse family of learners' seeking to challenge the whole child through innovation.",
        8,
        "identity",
        ["home", "about"],
      ),
      clue(
        "Its mission language emphasizes high expectations and excellence, especially in mathematics and science.",
        7,
        "mission",
        ["home", "about"],
      ),
      clue(
        "Its school history includes recognition as one of North Carolina's Blue Ribbon Schools in 2022.",
        6,
        "achievement",
        ["about"],
      ),
    ],
  },
  "southern-wake-academy": {
    sourceLinks: {
      home: "https://www.swake.org/",
      why: "https://swake.org/apps/pages/index.jsp?type=d&uREC_ID=552286",
    },
    clues: [
      clue(
        "Its mission highlights academic excellence through dynamic curriculum, nurturing relationships, and community involvement.",
        8,
        "mission",
        ["home"],
      ),
      clue(
        "Its public-facing values spell out PRIDE: perseverance, respect, integrity, determination, and empathy.",
        7,
        "identity",
        ["home"],
      ),
      clue(
        "Its public materials describe an independent-learning approach built around customization and accountability.",
        6,
        "model",
        ["why"],
      ),
    ],
  },
  "steele-creek-preparatory-academy": {
    sourceLinks: {
      home: "https://www.steelecreekprep.org/",
      about: "https://www.steelecreekprep.org/apps/pages/index.jsp?type=d&uREC_ID=376868",
    },
    clues: [
      clue(
        "Its four named pillars are passion, purpose, integrity, and grit.",
        8,
        "identity",
        ["home"],
      ),
      clue(
        "Its public materials promise 'strong minds' and 'good hearts.'",
        7,
        "identity",
        ["home"],
      ),
      clue(
        "Its school site highlights character education, leadership skills, and newer offerings such as performing arts, dual immersion, and Cambridge curriculum.",
        6,
        "program",
        ["home", "about"],
      ),
    ],
  },
  "stewart-creek-high": {
    sourceLinks: {
      home: "https://www.stewartcreekhs.com/",
      mission: "https://stewartcreekhs.com/apps/pages/index.jsp?type=d&uREC_ID=508716",
      program: "https://stewartcreekhs.com/apps/pages/index.jsp?type=d&uREC_ID=508712",
    },
    clues: [
      clue(
        "Its public promise is to help students finish school and accelerate their future through a non-traditional model.",
        8,
        "identity",
        ["home"],
      ),
      clue(
        "Its mission is aimed at students who have dropped out or are at risk of dropping out and need an alternate pathway to a diploma.",
        7,
        "mission",
        ["mission"],
      ),
      clue(
        "Its program model stresses flexible scheduling, self-paced coursework, and individualized success plans.",
        6,
        "model",
        ["program"],
      ),
    ],
  },
  "sugar-creek-charter": {
    sourceLinks: {
      home: "https://www.thesugarcreek.org/",
      about: "https://thesugarcreek.org/about/",
    },
    clues: [
      clue(
        "Its mission explicitly names eradicating generational poverty as a core goal.",
        8,
        "mission",
        ["about"],
      ),
      clue(
        "Its three pillars focus on academic preparation, postsecondary readiness, and life skills for success.",
        7,
        "identity",
        ["about"],
      ),
      clue(
        "Its public site identifies the Wildcats as the school mascot identity.",
        6,
        "identity",
        ["home"],
      ),
    ],
  },
  "telra-institute": {
    sourceLinks: {
      home: "https://www.telra.org/",
      attending: "https://www.telra.org/attending-telra",
      location: "https://www.telra.org/our-location",
    },
    clues: [
      clue(
        "Its public-facing promise is 'a challenging and accelerated experience for advanced learners.'",
        8,
        "identity",
        ["home"],
      ),
      clue(
        "Its educational model says each child follows their own trajectory.",
        7,
        "model",
        ["home"],
      ),
      clue(
        "Its current setup spans two campuses, with a separate site for high school students and a dual-enrollment connection to CPCC Levine.",
        6,
        "program",
        ["attending", "location"],
      ),
    ],
  },
  "the-math-and-science-academy-of-apex": {
    sourceLinks: {
      home: "https://tmsaapex.org/",
    },
    clues: [
      clue(
        "Its official identity names both mathematics and science directly.",
        6,
        "focus",
        ["home"],
      ),
    ],
  },
  "the-mountain-community-sch": {
    sourceLinks: {
      home: "https://www.themountaincommunityschool.com/",
      curriculum: "https://www.themountaincommunityschool.com/curriculum-and-activities/curriculum/",
    },
    clues: [
      clue(
        "Its mission emphasizes academic excellence, discovery, individuality, diversity, and a lifelong love of learning.",
        8,
        "mission",
        ["home"],
      ),
      clue(
        "Its program highlights experiential, hands-on learning and expeditionary trips to regional locations.",
        7,
        "program",
        ["home"],
      ),
      clue(
        "Its curriculum describes strong basic skills, core knowledge, and integrated units of study that connect learning to daily life.",
        6,
        "curriculum",
        ["curriculum"],
      ),
    ],
  },
  "thomas-academy": {
    sourceLinks: {
      why: "https://www.thomasacademync.org/our-school/why.html",
      contact: "https://www.thomasacademync.org/our-school/contact.html",
    },
    clues: [
      clue(
        "Its model is intentionally designed for students who have not performed well in larger, traditional school settings.",
        8,
        "model",
        ["why"],
      ),
      clue(
        "Its school approach integrates behavioral and therapeutic care with goals of graduation, postsecondary readiness, and career readiness.",
        7,
        "program",
        ["why"],
      ),
      clue(
        "Its campus sits on the grounds of Boys & Girls Homes of North Carolina.",
        6,
        "campus",
        ["contact"],
      ),
    ],
  },
  "triad-international-studies": {
    sourceLinks: {
      home: "https://www.tisanc.org/",
      mission: "https://www.tisanc.org/about-3",
      about: "https://www.tisanc.org/about-1",
    },
    clues: [
      clue(
        "Its mission is to develop global citizens with multilingual proficiency, intercultural competence, strong academics, and leadership skills.",
        8,
        "mission",
        ["mission"],
      ),
      clue(
        "Its public materials describe it as the first multi-language immersion public charter school in the Piedmont-Triad area.",
        7,
        "identity",
        ["home"],
      ),
      clue(
        "Its public program descriptions highlight immersion options in Chinese, Spanish, French, and Japanese.",
        6,
        "program",
        ["about"],
      ),
    ],
  },
  "unity-classical-charter-school": {
    sourceLinks: {
      home: "https://www.unityclassical.org/",
    },
    clues: [
      clue(
        "Its tagline pairs intellect and care: 'Empowering Minds, Nurturing Hearts.'",
        8,
        "identity",
        ["home"],
      ),
      clue(
        "Its public site says it is cultivating lifelong learners and virtuous leaders.",
        7,
        "identity",
        ["home"],
      ),
      clue(
        "Its public description emphasizes classical education focused on the whole child, academic excellence, and a culture of caring.",
        6,
        "mission",
        ["home"],
      ),
    ],
  },
  "water-s-edge-village-school": {
    sourceLinks: {
      home: "https://www.watersedgevillageschool.com/",
    },
    clues: [
      clue(
        "Its mission is tightly tied to serving an isolated coastal community rich in natural resources and environmentally focused organizations.",
        8,
        "mission",
        ["home"],
      ),
      clue(
        "Its instructional model is described as child-centered, integrated, hands-on, and project-based.",
        7,
        "model",
        ["home"],
      ),
      clue(
        "Its public identity uses the shorthand WEVS, pronounced like a rolling body of water.",
        6,
        "identity",
        ["home"],
      ),
    ],
  },
  "wayne-preparatory-academy": {
    sourceLinks: {
      academics: "https://wpanc.net/academics/",
      improvement: "https://wpanc.net/school-improvement-plan/",
      readyGroups: "https://wpanc.net/ready-groups/",
    },
    clues: [
      clue(
        "Its mission is to create a legacy of leadership and learning that embraces, enriches, and engages children's strengths, one child at a time.",
        8,
        "mission",
        ["improvement"],
      ),
      clue(
        "Its academic beliefs begin with the idea that all children will learn if they are taught carefully at their instructional level.",
        7,
        "philosophy",
        ["academics"],
      ),
      clue(
        "Its 'Ready Groups' enrichment program says it helps develop talented, engaged leaders who recognize and achieve their full potential.",
        6,
        "program",
        ["readyGroups"],
      ),
    ],
  },
  "west-lake-preparatory-academy": {
    sourceLinks: {
      home: "https://www.wlakeprep.org/",
      about: "https://www.wlakeprep.org/apps/pages/index.jsp?type=d&uREC_ID=377134",
      curriculum: "https://www.wlakeprep.org/apps/pages/index.jsp?type=d&uREC_ID=377138",
    },
    clues: [
      clue(
        "Its public model is framed as 'The Village Model.'",
        8,
        "identity",
        ["home"],
      ),
      clue(
        "Its mission promises to build strong minds and good hearts while personalizing learning around passions, interests, and strengths.",
        7,
        "mission",
        ["home", "about"],
      ),
      clue(
        "Its curriculum page emphasizes one-to-one instructional time and tailored educational plans for individual students.",
        6,
        "curriculum",
        ["curriculum"],
      ),
    ],
  },
  "wilmington-preparatory-academy": {
    sourceLinks: {
      home: "https://www.wilmingtonprep.com/",
    },
    clues: [
      clue(
        "Its homepage motto is a three-word sequence: encourage, respect, learn.",
        8,
        "identity",
        ["home"],
      ),
      clue(
        "Its public materials say it offers a Core Knowledge curriculum in a rich and stimulating environment.",
        7,
        "curriculum",
        ["home"],
      ),
      clue(
        "Its site prominently features Read to Achieve results as part of its public academic profile.",
        6,
        "program",
        ["home"],
      ),
    ],
  },
  "z-e-c-a-school-of-arts-and-technology": {
    sourceLinks: {
      home: "https://www.zecaschoolofthearts.com/",
      about: "https://www.zecaschoolofthearts.com/about-our-school",
      mission: "https://www.zecaschoolofthearts.com/mission-and-vision",
    },
    clues: [
      clue(
        "Its mission combines a safe, nurturing environment with a strong emphasis on arts, diversity, and technology.",
        8,
        "mission",
        ["mission"],
      ),
      clue(
        "Its vision speaks about helping students re-engage successfully in school while building self-confidence and self-worth.",
        7,
        "vision",
        ["mission"],
      ),
      clue(
        "Its public identity includes a mascot reference to Eagles.",
        6,
        "identity",
        ["about"],
      ),
    ],
  },
};

function clue(text, difficulty, category, sourceRefs) {
  return { text, difficulty, category, sourceRefs };
}

function normalizeUrl(url) {
  if (!url) {
    return "";
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+\.[A-Za-z]{2,}/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return "";
}

function domainFromUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return "";
  }

  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function namePatternClues(name) {
  const lower = name.toLowerCase();
  const clues = [];

  const addIf = (needle, text) => {
    if (lower.includes(needle)) {
      clues.push(clue(text, 5, "focus", ["schoolRecord"]));
    }
  };

  addIf("leadership", "Leadership development is built directly into its official identity.");
  addIf("montessori", "Its instructional identity is explicitly Montessori.");
  addIf("classical", "Its instructional identity is explicitly classical.");
  addIf("experiential", "Experiential learning is built directly into its official identity.");
  addIf("international", "Its official identity includes an international emphasis.");
  addIf("community", "Community is built directly into its official identity.");
  addIf("village", "Village is part of its official identity.");
  addIf("public", "The word Public appears directly in its official identity.");
  addIf("institute", "It presents itself as an institute rather than a traditional academy or school.");
  addIf("stream", "Its official identity explicitly references STREAM disciplines.");
  addIf("stem", "Its official identity explicitly references STEM disciplines.");
  addIf("steam", "Its official identity explicitly references STEAM disciplines.");
  addIf("arts", "The arts are named directly in its official identity.");
  addIf("digital", "Digital learning or media is named directly in its official identity.");
  addIf("visual", "Visual art is named directly in its official identity.");
  addIf("technology", "Technology is named directly in its official identity.");
  addIf("math", "Mathematics is named directly in its official identity.");
  addIf("science", "Science is named directly in its official identity.");
  addIf("aerospace", "Aerospace is named directly in its official identity.");

  if (lower.includes("prep") || lower.includes("preparatory")) {
    clues.push(
      clue(
        "Its official identity emphasizes preparation for what comes next.",
        5,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  return clues;
}

function structureClues(name) {
  const clues = [];

  if (name.includes(":")) {
    clues.push(clue("Its official name includes a colon.", 4, "identity", ["schoolRecord"]));
  }

  if (name.includes("&")) {
    clues.push(clue("Its official name includes an ampersand.", 4, "identity", ["schoolRecord"]));
  }

  if (name.includes("-")) {
    clues.push(clue("Its official name includes a hyphen.", 4, "identity", ["schoolRecord"]));
  }

  if (/[A-Z]\.[A-Z]\.[A-Z]/.test(name)) {
    clues.push(
      clue(
        "Its official name includes initials separated by periods.",
        5,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  if (/School of/i.test(name)) {
    clues.push(
      clue(
        "Its official name uses the phrase 'School of.'",
        5,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  if (name.trim().split(/\s+/).length >= 5) {
    clues.push(
      clue(
        "Its official name is longer than many charter school names.",
        4,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  return clues;
}

function lexicalClues(name) {
  const words = name
    .replace(/[:&(),.-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !COMMON_NAME_WORDS.has(word.toLowerCase()))
    .filter((word) => word.length > 2);

  const unique = [...new Set(words)];
  return unique.slice(0, 4).map((word, index) =>
    clue(
      `One distinctive word in its official name is "${word}".`,
      Math.max(3, 5 - index),
      "identity",
      ["schoolRecord"],
    ),
  );
}

function edgeWordClues(name) {
  const words = name
    .replace(/[:&(),.-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const clues = [];
  const first = words[0];
  const last = words[words.length - 1];

  if (first) {
    clues.push(
      clue(
        `Its official name begins with the word "${first}".`,
        4,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  if (last && last !== first) {
    clues.push(
      clue(
        `Its official name ends with the word "${last}".`,
        4,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  clues.push(
    clue(
      `Its official name contains ${words.length} words.`,
      3,
      "identity",
      ["schoolRecord"],
    ),
  );

  if (words.length <= 2) {
    clues.push(
      clue(
        "Its official name is unusually short compared with many charter school names.",
        3,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  return clues;
}

function commonWordClues(name) {
  const lower = name.toLowerCase();
  const clues = [];

  if (lower.includes("academy")) {
    clues.push(clue("The word Academy appears in its official name.", 3, "identity", ["schoolRecord"]));
  }
  if (lower.includes("school")) {
    clues.push(clue("The word School appears in its official name.", 3, "identity", ["schoolRecord"]));
  }
  if (lower.includes("charter")) {
    clues.push(clue("The word Charter appears in its official name.", 3, "identity", ["schoolRecord"]));
  }
  if (lower.includes("prep") || lower.includes("preparatory")) {
    clues.push(
      clue(
        "Preparation is named directly in its official title.",
        3,
        "identity",
        ["schoolRecord"],
      ),
    );
  }

  return clues;
}

function autoCluesForSchool(school) {
  const clues = [];
  const domain = domainFromUrl(school.url);

  if (domain) {
    clues.push(
      clue(
        `Its official website uses the domain ${domain}.`,
        4,
        "identity",
        ["home"],
      ),
    );
  }

  clues.push(...namePatternClues(school.officialName));
  clues.push(...structureClues(school.officialName));
  clues.push(...lexicalClues(school.officialName));
  clues.push(...edgeWordClues(school.officialName));
  clues.push(...commonWordClues(school.officialName));

  return clues;
}

function mergeSourceLinks(school, enrichment) {
  const sourceLinks = {
    schoolRecord: "https://www.dpi.nc.gov/students-families/alternative-choices/charter-schools",
  };

  const normalizedSchoolUrl = normalizeUrl(school.url);
  if (normalizedSchoolUrl) {
    sourceLinks.home = normalizedSchoolUrl;
  }

  if (enrichment?.sourceLinks) {
    Object.assign(sourceLinks, enrichment.sourceLinks);
  }

  return sourceLinks;
}

function uniqueClueObjects(clues) {
  const seen = new Set();
  const result = [];

  for (const item of clues) {
    const key = item.text.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

async function main() {
  const [schoolsRaw, clueBankRaw] = await Promise.all([
    fs.readFile(schoolsPath, "utf8"),
    fs.readFile(clueBankPath, "utf8"),
  ]);

  const schools = JSON.parse(schoolsRaw);
  const clueBank = JSON.parse(clueBankRaw);
  const validatedIds = new Set(
    clueBank.schools
      .filter((school) => String(school.status || "").startsWith("validated-batch-"))
      .filter((school) => school.status !== "validated-batch-034")
      .map((school) => school.schoolId),
  );

  const remaining = schools.filter((school) => !validatedIds.has(school.id));

  const output = {
    generatedAt: "2026-05-08",
    notes: [
      "Thirty-fourth validated clue batch rebuilt with richer mission, model, and identity clues for previously sparse-site schools.",
      "Official school websites are used where available, with state-linked official roster metadata and a small number of reputable secondary references used to close gaps.",
      "Clues intentionally avoid revealing enrollment size, grade span, or directional/proximity information because those are gameplay feedback channels.",
    ],
    schools: remaining.map((school) => {
      const enrichment = MANUAL_ENRICHMENTS[school.id];
      const clues = uniqueClueObjects([
        ...(enrichment?.clues || []),
        ...autoCluesForSchool(school),
      ]).slice(0, 6);

      return {
        schoolId: school.id,
        officialName: school.officialName,
        status: "validated-batch-034",
        qualityTier: "completion-generated",
        sourceLinks: mergeSourceLinks(school, enrichment),
        clues,
      };
    }),
  };

  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${output.schools.length} schools to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
