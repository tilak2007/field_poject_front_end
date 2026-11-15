import type { User } from '../types/auth';

const knownMetros = [
  'bengaluru',
  'mumbai',
  'delhi',
  'kolkata',
  'chennai',
  'hyderabad',
  'pune',
  'ahmedabad',
];

function normalizeCity(str: string): string {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/\bbangalore\b/gi, 'bengaluru')
    .replace(/\bblr\b/gi, 'bengaluru')
    .replace(/\bbombay\b/gi, 'mumbai')
    .replace(/\bcalcutta\b/gi, 'kolkata')
    .replace(/\bmadras\b/gi, 'chennai');
}

/**
 * Checks if a representative, outlet, or beat belongs to a manager's assigned territory / jurisdiction.
 * 
 * Strict Role-Based Governance:
 * 1. System Admin: Global All-India executive jurisdiction — can view and track all representatives nationwide.
 * 2. Sales Manager: Strictly restricted to representatives within their designated territory/region.
 *    - A manager assigned to Bengaluru can ONLY track Bengaluru reps.
 *    - Reps from other territories (e.g. Mumbai, Delhi, Kolkata) are strictly isolated and hidden.
 * 3. Sales Representative: Personal privacy isolation — cannot track peer reps.
 */
export function isUnderManagerTerritory(
  managerUser: User | null | undefined,
  target: { territory?: string; region?: string; city?: string }
): boolean {
  if (!managerUser) return false;

  // 1. System Admin has nationwide executive authority across all territories
  if (managerUser.role === 'System Admin') return true;

  // 2. Sales Representatives cannot track other reps (strict personal isolation)
  if (managerUser.role === 'Sales Representative') return false;

  const mgrTerritory = normalizeCity(managerUser.territory || '');
  const mgrRegion = normalizeCity(managerUser.region || '');
  const repTerritory = normalizeCity(target.territory || '');
  const repRegion = normalizeCity(target.region || '');
  const repCity = normalizeCity(target.city || '');

  // 3. National HQ / All India Manager override
  if (
    mgrTerritory.includes('national') ||
    mgrTerritory.includes('all india') ||
    mgrRegion.includes('all india')
  ) {
    return true;
  }

  // 4. Metropolitan City Boundary Check (Bengaluru, Mumbai, Delhi, Kolkata, etc.)
  const mgrMetro = knownMetros.find(
    (m) => mgrTerritory.includes(m) || mgrRegion.includes(m)
  );

  if (mgrMetro) {
    const repInSameMetro =
      repTerritory.includes(mgrMetro) ||
      repRegion.includes(mgrMetro) ||
      repCity.includes(mgrMetro);

    // If rep is in a different metropolitan territory, strictly forbidden!
    if (!repInSameMetro) {
      return false;
    }

    // Check if manager has a sub-zone specified within the metro:
    const subZones = ['south', 'north', 'east', 'west', 'central'];
    const mgrSubZone = subZones.find((z) => mgrTerritory.includes(z));
    const repSubZone = subZones.find((z) => repTerritory.includes(z));

    if (mgrSubZone && repSubZone) {
      return (
        mgrSubZone === repSubZone ||
        repTerritory.includes(mgrTerritory) ||
        mgrTerritory.includes(repTerritory)
      );
    }

    // City-wide manager oversees all reps in that metropolitan cluster
    return true;
  }

  // 5. Fallback direct match for non-metro custom territories
  if (
    mgrTerritory &&
    (repTerritory.includes(mgrTerritory) || mgrTerritory.includes(repTerritory))
  ) {
    return true;
  }

  if (
    mgrRegion &&
    repRegion &&
    (repRegion.includes(mgrRegion) || mgrRegion.includes(repRegion))
  ) {
    return true;
  }

  return false;
}
