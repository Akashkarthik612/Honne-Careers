// CV templates. Only Jake's Resume is live in the beta; the rest show as "Coming soon" (design: TemplatePicker).
// CvDoc can already render Elegant, so enabling it is a flag flip once PDF-1's LaTeX template exists.
export const TEMPLATES = [
  { id: 'jake', name: 'Jake’s Resume', blurb: 'ATS-safe · one page, single column', available: true },
  { id: 'elegant', name: 'Elegant', blurb: 'Formal, with clear section rules', available: false },
  { id: 'classic', name: 'Classic', blurb: 'Traditional, centred header', available: false },
  { id: 'modern', name: 'Modern', blurb: 'Accent headings, skill chips', available: false },
];

export const templateName = (id) => TEMPLATES.find((t) => t.id === id)?.name ?? id;
