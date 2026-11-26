import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { CvThumb } from '@/components/CvDoc';
import { profileToCv } from '@/data/cvModel';
import { templatePreviewProfile } from '@/data/templatePreview';
import { TEMPLATES } from '@/data/templates';
import { useReducedMotion } from '../landingHooks';
import { Chevron, Reveal } from './parts';

const cards = TEMPLATES.map((template) => ({
  ...template,
  cv: profileToCv(templatePreviewProfile(template.id)),
}));

export default function Templates() {
  const reduce = useReducedMotion();
  const track = useRef(null);

  function scroll(direction) {
    const row = track.current;
    const card = row?.firstElementChild;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: reduce ? 'instant' : 'smooth' });
  }

  return (
    <section id="templates" aria-labelledby="tp-h" style={{ borderTop: '1px solid #E8E6E3' }}>
      <div className="wrap frame sec">
        <Reveal>
          <div className="tplhead">
            <div>
              <h2 id="tp-h" className="h2">Find a resume for <span className="lead">the role you want.</span></h2>
              <p className="sub">Browse seven sample resumes before signing in. Each layout uses one column and exports as a selectable-text PDF.</p>
            </div>
            <div className="tplcontrols">
              <button type="button" className="iconbtn" onClick={() => scroll(-1)} aria-label="Previous template"><Chevron size={16} dir="left" /></button>
              <button type="button" className="iconbtn" onClick={() => scroll(1)} aria-label="Next template"><Chevron size={16} /></button>
            </div>
          </div>
          <ul ref={track} className="tpltrack" aria-label="Resume templates" data-lenis-prevent-horizontal>
            {cards.map(({ id, name, audience, blurb, cv }) => (
              <li key={id} className="card tplcard">
                <div inert><CvThumb cv={cv} template={id} height={356} radius={10} /></div>
                <div className="tplbody">
                  <h3 className="h">{name}</h3>
                  <p className="tplaudience">{audience}</p>
                  <p>{blurb}</p>
                  <Link className="btn-s" to={`/new/template?template=${id}`} aria-label={`Use ${name} template`}>Use template <Chevron size={14} /></Link>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
