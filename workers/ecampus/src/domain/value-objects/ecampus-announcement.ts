export interface EcampusAnnouncement {
    title: string;
    /** DD/MM/AAAA as printed by eCampus ("Postada em: ..."), or null if absent. */
    postedDate: string | null;
    bodyHtml: string;
}
