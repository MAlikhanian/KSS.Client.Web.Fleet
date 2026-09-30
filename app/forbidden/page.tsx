import { ForbiddenNotice } from './forbidden-notice';

/**
 * Shown by the middleware (a rewrite, so the URL is unchanged) to a signed-in
 * person without the Fleet read permission. Deliberately outside app/(fleet):
 * nothing here fetches Fleet data.
 *
 * A server component, so its marker is in the server payload even while the
 * session guard is still loading on the client.
 */
export default function ForbiddenPage() {
  return (
    <div data-testid="fleet-forbidden">
      <ForbiddenNotice />
    </div>
  );
}
