import {ARCHIVED, ARCHIVE_SNAPSHOT} from '../../archive';

export default function ArchiveBanner() {
    if (!ARCHIVED) return null;
    return (
        <div className="archive-banner" role="note">
            <strong>Archived.</strong> BlackBoxDelta was an automated forex trading system: thousands of
            transformer models, live from March to October 2026. It never turned a profit, so I shut it down.
            Every page is open to look around, but nothing is live, the controls are disabled, and the data
            is frozen at {ARCHIVE_SNAPSHOT}. <a href="https://dustinmorgan.org/projects/">dustinmorgan.org</a>
        </div>
    );
}
