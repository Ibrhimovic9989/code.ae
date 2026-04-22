import { redirect } from 'next/navigation';

// Root redirects to the English locale. A middleware-based geolocation switch
// could redirect Gulf IPs to /ar, but for now we default to English (the
// sign-in flow switches locales on its own).
export default function RootPage(): never {
  redirect('/en');
}
