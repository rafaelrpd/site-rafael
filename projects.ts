export interface Project {
  id: string;
  titleKey: string;
  descriptionKey: string;
  repoUrl: string;
}

export const projects: Project[] = [
  {
    id: 'site-rafael',
    titleKey: 'project.site.title',
    descriptionKey: 'project.site.description',
    repoUrl: 'https://github.com/rafaelrpd/site-rafael',
  },
];

export function renderProjects(): void {
  const projectsGrid = document.getElementById('projects-grid');
  if (!projectsGrid) return;

  // Clear loading state
  projectsGrid.innerHTML = '';

  projects.forEach((project) => {
    const card = document.createElement('a');
    card.href = project.repoUrl;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.className = 'card glass project-card';

    const title = document.createElement('h3');
    title.dataset.i18n = project.titleKey;
    title.textContent = 'Loading...'; // Fallback text

    const description = document.createElement('p');
    description.dataset.i18n = project.descriptionKey;
    description.textContent = 'Loading...'; // Fallback text

    card.appendChild(title);
    card.appendChild(description);
    projectsGrid.appendChild(card);
  });
}
