// Template names and blurbs (UI copy). Which ones are live, and each one's default section order, come
// from GET /templates (the backend's TemplateRegistry); any not listed there show as "Coming soon".
export const TEMPLATES = [
  { id: 'jake', name: 'Jake’s Resume', blurb: 'For entry-level candidates · one page, single column' },
  { id: 'honne_professional', name: 'Honne Professional', blurb: 'For experienced professionals · experience first' },
  { id: 'elegant', name: 'Elegant', blurb: 'Formal, with clear section rules' },
  { id: 'classic', name: 'Classic', blurb: 'Traditional, centred header' },
  { id: 'modern', name: 'Modern', blurb: 'Accent headings, skill chips' },
];

export const templateName = (id) => TEMPLATES.find((t) => t.id === id)?.name ?? id;

// The movable CV sections (backend SectionKey), with the titles each template prints.
export const SECTION_LABELS = {
  experience: 'Experience', projects: 'Projects', skills: 'Technical skills',
  education: 'Education', certifications: 'Certifications', languages: 'Languages',
};

// Shown until GET /templates answers; must equal the backend's defaults (TemplateRegistry).
const FALLBACK_ORDER = {
  jake: ['education', 'experience', 'projects', 'skills', 'certifications', 'languages'],
  honne_professional: ['experience', 'projects', 'skills', 'education', 'certifications', 'languages'],
};

// The order a resume prints in: its own, else its template's default (from GET /templates when loaded).
export function sectionOrderOf(resume, templates = null) {
  if (resume.sectionOrder) return resume.sectionOrder;
  const live = templates?.find((t) => t.id === resume.template)?.default_order;
  return live ?? FALLBACK_ORDER[resume.template] ?? FALLBACK_ORDER.jake;
}

// Moves the section at `index` up (-1) or down (+1); returns a new array (unchanged at the ends).
export function moveSection(order, index, step) {
  const to = index + step;
  if (to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
