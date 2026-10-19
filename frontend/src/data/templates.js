// Template names and blurbs (UI copy). Which ones are live comes from GET /templates (the backend's
// TemplateRegistry); any not listed there show as "Coming soon" (design: TemplatePicker).
export const TEMPLATES = [
  { id: 'jake', name: 'Jake’s Resume', blurb: 'ATS-safe · one page, single column' },
  { id: 'elegant', name: 'Elegant', blurb: 'Formal, with clear section rules' },
  { id: 'classic', name: 'Classic', blurb: 'Traditional, centred header' },
  { id: 'modern', name: 'Modern', blurb: 'Accent headings, skill chips' },
];

export const templateName = (id) => TEMPLATES.find((t) => t.id === id)?.name ?? id;
