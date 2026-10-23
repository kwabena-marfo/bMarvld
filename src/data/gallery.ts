export const photoCategories = ["Portraits", "Fashion", "Kids", "Graduation", "Branding"] as const;

export type Shot = {
  id?: string;
  src: string;
  alt: string;
  category: (typeof photoCategories)[number];
  width: number;
  height: number;
};

// B.Marvld's portfolio, bundled in public/gallery (web-sized from the original
// Drive folder). Always shown on the site after any photos uploaded from
// /admin/gallery. Ordered to mix sessions and styles.
const shot = (n: string, category: Shot["category"], alt: string, height = 2400): Shot => ({
  src: `/gallery/bm-${n}.jpg`,
  alt,
  category,
  width: 1600,
  height,
});

export const portfolio: Shot[] = [
  shot("03", "Portraits", "Woman in a feathered black dress against gold curtains"),
  shot("09", "Fashion", "Man in a cream suit holding a leather briefcase"),
  shot("32", "Portraits", "Close-up portrait with window-blind shadows", 2000),
  shot("19", "Kids", "Black and white portrait of a young girl, hands on her cheeks", 2000),
  shot("26", "Portraits", "Woman in an orange and pink outfit on a burgundy backdrop"),
  shot("12", "Fashion", "Man in a white embroidered kaftan seated on a red set"),
  shot("07", "Portraits", "Woman in a white gown framed by white drapes"),
  shot("10", "Fashion", "Man in a cream suit and hat walking through warm light"),
  shot("24", "Kids", "Girl in a white tulle dress with star projections", 2241),
  shot("31", "Portraits", "Woman in a checkered dress against a painted blue backdrop"),
  shot("13", "Portraits", "Woman in an olive dress in a glowing arch", 2453),
  shot("04", "Portraits", "Black and white portrait in a feathered dress"),
  shot("08", "Fashion", "Man in a cream suit and fedora striking a pose"),
  shot("22", "Kids", "Black and white portrait of a girl with butterfly light projections", 2001),
  shot("36", "Branding", "Smiling professional at a laptop, brand portrait", 2399),
  shot("14", "Portraits", "Woman in a white peplum dress between sheer curtains"),
  shot("29", "Portraits", "Smiling woman with long braids on a burgundy backdrop"),
  shot("05", "Portraits", "Woman seated in a velvet armchair on a green backdrop"),
  shot("01", "Kids", "Girl in a cream sweatsuit on a pink backdrop", 2133),
  shot("37", "Graduation", "Graduate celebrating with confetti outside campus", 2401),
  shot("02", "Portraits", "Black and white seated portrait in a beaded dress", 2133),
  shot("11", "Fashion", "Man in a cream suit seated on a stool holding a hat"),
  shot("18", "Portraits", "Moody low-key portrait in a beaded black dress"),
  shot("06", "Portraits", "Woman in a sage two-piece leaning on a plinth"),
  shot("21", "Kids", "Girl in a tulle dress with butterfly light projections"),
  shot("33", "Portraits", "Woman in a feathered top against a curved cream wall", 2401),
  shot("30", "Portraits", "Woman seated on a wooden chair in an orange outfit", 2000),
  shot("15", "Portraits", "Playful pose in a beaded dress on a grey set", 2401),
  shot("34", "Kids", "Smiling girl seated on draped fabric, pink backdrop", 2133),
  shot("38", "Graduation", "Graduate in cap and kente stole outside campus", 2401),
  shot("16", "Portraits", "Over-the-shoulder portrait in a beaded dress"),
  shot("27", "Portraits", "Woman seated on a white cube looking upward"),
  shot("25", "Kids", "Girl in a white party dress, hand on hip"),
  shot("20", "Portraits", "Laughing woman reclining beside pampas grass"),
  shot("28", "Portraits", "Woman resting her head on her hand, burgundy backdrop"),
  shot("17", "Kids", "Girl in a cream sweatsuit with a red bow, pink backdrop"),
  shot("23", "Kids", "Girl blowing a kiss amid butterfly light projections"),
  shot("35", "Kids", "Girl lounging playfully on a pink set", 2133),
];

// The hero pairs two portraits either side of the logo.
export const heroLeft = portfolio.find((s) => s.src.endsWith("bm-10.jpg"))!; // man in cream suit walking side-on with briefcase
export const heroRight = portfolio.find((s) => s.src.endsWith("bm-13.jpg"))!; // woman in olive dress, arms raised

// Blurred behind the booking form: the studio set with curtains, pendant lamp and plants.
// Swap for a photo of the empty studio when there is one.
export const studioBackdrop = portfolio.find((s) => s.src.endsWith("bm-03.jpg"))!;