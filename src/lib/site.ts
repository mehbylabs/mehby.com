// Facts about the site that more than one module needs, and that have no
// dependencies of their own.
//
// This module exists for a bundling reason as well as a tidiness one.
// src/lib/contact.ts holds the server half of the form and imports zod at
// module scope, so anything that reaches for a constant declared there drags
// zod into its chunk. The footer is rendered by the root route, which is to
// say on every page, and importing the address from contact.ts put zod in the
// entry bundle for the whole site. Keeping the shared constants dependency
// free is what stops a one-line import having that reach.

/**
 * Where enquiries go. Not configurable: it is the address printed on the page,
 * and a destination that disagreed with the printed address would send mail
 * somewhere the visitor was not told about.
 */
export const CONTACT_DESTINATION = 'hello@mehby.com'
