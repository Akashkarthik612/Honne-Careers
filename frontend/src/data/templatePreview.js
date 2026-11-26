// Illustrative content for the template picker's thumbnail only (design canvas: "Arjun Mehta").
// It is never a user's data and never sent to the API.

export const PREVIEW_PROFILE = {
  personal: {
    name: 'Arjun Mehta', city: 'Chennai, India', email: 'arjun.mehta@mail.com', phone: '+91 98xxx xxxxx',
    linkedin: 'linkedin.com/in/arjunmehta', github: 'github.com/arjunm',
  },
  roles: [
    {
      id: 'r1', role: 'Software Engineer', company: 'Northwind Fintech', start: 'Jul 2021', end: 'Present', location: 'Bengaluru, India',
      bullets: [
        { id: 'b1', text: 'Moved the ledger service to Kafka Streams in Java on AWS; p95 latency went down about 38%.' },
        { id: 'b2', text: 'Owned the settlement pipeline — 2M events/day, no data loss. Added idempotent consumers and replay tooling.' },
        { id: 'b3', text: 'Mentored 2 interns to their first production launch, both shipping in under 8 weeks' },
      ],
    },
    {
      id: 'r2', role: 'Associate Software Engineer', company: 'Brightline Systems', start: 'Aug 2020', end: 'Jun 2021', location: 'Chennai, India',
      bullets: [
        { id: 'b4', text: 'Reduced on-call pages by 30% by adding alerting and runbooks across 6 Java services' },
        { id: 'b5', text: 'Wrote SQL migrations for a 40M-row orders table with no downtime' },
      ],
    },
  ],
  projects: [
    { id: 'p1', name: 'Ledger-lite', tech: 'Java, Spring Boot, PostgreSQL', year: '2023', bullets: [{ id: 'pb1', text: 'Double-entry ledger. 1,000 TPS in k6 load tests.' }] },
  ],
  education: [
    { id: 'e1', school: 'Anna University', degree: 'B.E. Computer Science and Engineering', years: '2016 – 2020', city: 'Chennai, India' },
  ],
  skills: {
    lang: ['Java', 'Python', 'SQL'],
    fw: ['Spring Boot', 'Kafka Streams', 'JUnit'],
    tools: ['AWS (EC2, SQS, RDS)', 'Git', 'Grafana'],
  },
  spoken: [{ id: 'l1', name: 'English', level: 'professional' }, { id: 'l2', name: 'Tamil', level: 'native' }],
  certs: [{ id: 'c1', name: 'AWS Certified Developer', issuer: 'Amazon Web Services', date: '2023' }],
};

const CAREER_SAMPLES = {
  graduate: {
    role: 'Operations Intern', project: 'Campus Food Bank Inventory',
    result: 'Mapped weekly demand and built a stock tracker for the student volunteer team.',
    projectResult: 'Analyzed three semesters of donation data for a capstone presentation.',
    skills: ['Excel', 'Data analysis', 'Presentation'],
  },
  marketing: {
    role: 'Growth Marketing Specialist', project: 'Product Launch Campaign',
    result: 'Increased qualified sign-ups by 18% through landing-page and email experiments.',
    projectResult: 'Coordinated launch messaging, email sequences, and channel reporting.',
    skills: ['Google Analytics', 'SEO', 'A/B testing'],
  },
  sales: {
    role: 'Account Executive', project: 'Outbound Prospecting Pilot',
    result: 'Reached 112% of annual quota by developing mid-market accounts.',
    projectResult: 'Built a prospecting sequence for a new territory.',
    skills: ['Salesforce', 'Pipeline management', 'B2B sales'],
  },
  customer_success: {
    role: 'Customer Success Manager', project: 'Customer Onboarding Playbook',
    result: 'Managed 35 accounts and ran quarterly reviews to identify adoption and renewal risks.',
    projectResult: 'Standardized handoffs and milestones for new accounts.',
    skills: ['Onboarding', 'Customer health', 'Gainsight'],
  },
  project_operations: {
    role: 'Operations Project Manager', project: 'Order Workflow Redesign',
    result: 'Led a cross-functional rollout across four sites and tracked milestones and risks.',
    projectResult: 'Reduced processing time by 15% through revised intake and routing.',
    skills: ['Project planning', 'Process mapping', 'Jira'],
  },
};

export function templatePreviewProfile(template) {
  if (template === 'jake') {
    return {
      ...PREVIEW_PROFILE,
      roles: [{
        ...PREVIEW_PROFILE.roles[0],
        role: 'Software Engineering Intern',
        start: 'May 2025',
        end: 'Aug 2025',
        bullets: [{ id: 'b1', text: 'Added API tests for account updates using Python and pytest.' }],
      }],
      projects: [{
        id: 'p1', name: 'Campus Placement Tracker', tech: 'Python, FastAPI, PostgreSQL', year: '2026',
        bullets: [{ id: 'pb1', text: 'Built REST endpoints for applications and tested status updates with pytest.' }],
      }],
      education: [{ ...PREVIEW_PROFILE.education[0], years: '2022 – 2026' }],
      skills: { lang: ['Python', 'SQL'], fw: ['FastAPI', 'pytest'], tools: ['PostgreSQL', 'Git'] },
      certs: [],
    };
  }
  if (!Object.hasOwn(CAREER_SAMPLES, template)) return PREVIEW_PROFILE;
  const sample = CAREER_SAMPLES[template];
  const graduate = template === 'graduate';
  return {
    ...PREVIEW_PROFILE,
    personal: { ...PREVIEW_PROFILE.personal, github: '' },
    roles: [{
      ...PREVIEW_PROFILE.roles[0],
      role: sample.role,
      company: 'Brightline Group',
      start: graduate ? 'May 2025' : 'Jul 2022',
      end: graduate ? 'Aug 2025' : 'Present',
      bullets: [{ id: 'b1', text: sample.result }],
    }],
    projects: [{
      id: 'p1', name: sample.project, tech: '', year: '2025',
      bullets: [{ id: 'p1b1', text: sample.projectResult }],
    }],
    education: [{
      ...PREVIEW_PROFILE.education[0],
      degree: 'B.B.A. Business Administration',
      years: graduate ? '2022 – 2026' : '2018 – 2022',
    }],
    skills: { lang: [], fw: [], tools: sample.skills },
    certs: [],
  };
}
