// Requires the generated API content (`yarn build:docs`), which CI runs
// before this suite.
it('DruxtJS.org: API documentation', () => {
  cy.visit('/api')

  cy.get('h1').should('have.text', 'Packages')

  // The index links each package's generated reference.
  cy.contains('a', 'Read the docs').should('exist')

  // A generated API document renders with its source link.
  cy.visit('/api/packages/druxt/client')
  cy.get('h1').should('contain', 'DruxtClient')
  cy.contains('a', 'View source on GitHub').should('exist')
})

// An options table re-flows in two tiers from 640px up, and keeps its table
// roles while it does, so the headings still read to assistive tech.
it('DruxtJS.org: API options table in two tiers', () => {
  for (const [width, height] of [[768, 800], [1536, 900]]) {
    cy.viewport(width, height)
    cy.visit('/api/packages/druxt/client')
    cy.contains('th', 'Default')
      .closest('table')
      .should('have.attr', 'role', 'table')
      .closest('.docs-table')
      .should('have.attr', 'data-tiers')
      .and('not.have.attr', 'data-overflow')
    cy.contains('th', 'Default').closest('table').find('tbody tr').first().should('have.css', 'display', 'grid')
  }
})
