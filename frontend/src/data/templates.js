// Template names and blurbs (UI copy). Which ones are live, and each one's default section order, come
// from GET /templates (the backend's TemplateRegistry).
export const TEMPLATES = [
  { id: 'jake', name: 'Jake’s Resume', audience: 'Early-career tech applicants', blurb: 'Use a compact layout for technical projects, internships, and skills.' },
  { id: 'honne_professional', name: 'Honne Professional', audience: 'Candidates with work experience', blurb: 'Lead with past roles, responsibilities, and results.' },
  { id: 'customer_success', name: 'Customer Success', audience: 'Onboarding and customer-facing applicants', blurb: 'Show how you supported customers, improved adoption, or helped retain accounts.' },
];

export const templateName = (id) => TEMPLATES.find((t) => t.id === id)?.name ?? id;

// The movable CV sections (backend SectionKey), with the titles each template prints.
export const SECTION_LABELS = {
  experience: 'Experience', projects: 'Projects', skills: 'Technical skills',
  education: 'Education', certifications: 'Certifications', languages: 'Languages',
};

// Shown until GET /templates answers; must equal the backend's defaults (TemplateRegistry).
export const CAREER_STYLES = {
  customer_success: { projects: 'Projects', accent: '#1A5266' },
};

const FALLBACK_ORDER = {
  jake: ['education', 'experience', 'projects', 'skills', 'certifications', 'languages'],
  honne_professional: ['experience', 'projects', 'skills', 'education', 'certifications', 'languages'],
  customer_success: ['experience', 'skills', 'education', 'projects', 'certifications', 'languages'],
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
