export const photoCategories = ["Portraits", "Fashion", "Kids", "Graduation", "Branding"] as const;

export type Shot = {
  id?: string;
  src: string;
  alt: string;
  category: (typeof photoCategories)[number];
  width: number;
  height: number;
};

// The hero pairs two portraits either side of the logo.
export const heroLeft = { src: "/gallery/bm-hero-man-3.jpg" }; // smiling man in a striped brown and gold smock, mid-twirl
export const heroRight = { src: "/gallery/bm-hero-lady.jpg" }; // woman in olive dress, arms raised

// Blurred behind the booking form: the studio set with white drapes and glowing cream arches.
// Swap for a photo of the empty studio when there is one.
export const studioBackdrop = { src: "/gallery/bm-07.jpg" };