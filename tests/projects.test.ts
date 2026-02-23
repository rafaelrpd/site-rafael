import { describe, it, expect, beforeEach } from 'vitest';
import { renderProjects, projects } from '../projects';

describe('projects rendering', () => {
    beforeEach(() => {
        document.body.innerHTML = `
      <div id="projects-grid"></div>
    `;
    });

    it('renders projects correctly into the grid', () => {
        renderProjects();

        const grid = document.getElementById('projects-grid');
        expect(grid).not.toBeNull();

        const cards = grid!.querySelectorAll('.project-card');
        expect(cards.length).toBe(projects.length);

        // Check the first card structure based on the mock data
        const firstCard = cards[0] as HTMLAnchorElement;
        expect(firstCard.href).toBe('https://github.com/rafaelrpd/site-rafael');
        expect(firstCard.target).toBe('_blank');

        // Title and description checks
        const title = firstCard.querySelector('h3');
        const description = firstCard.querySelector('p');

        expect(title).not.toBeNull();
        expect(title!.dataset.i18n).toBe('project.site.title');

        expect(description).not.toBeNull();
        expect(description!.dataset.i18n).toBe('project.site.description');
    });

    it('does nothing if grid element is missing', () => {
        document.body.innerHTML = ''; // no projects-grid

        expect(() => renderProjects()).not.toThrow();
    });
});
