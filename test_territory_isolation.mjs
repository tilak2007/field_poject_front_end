// Verification test suite for Territory Governance & Sales Manager Fleet Scoping

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

function normalizeCity(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\bbangalore\b/gi, 'bengaluru')
    .replace(/\bblr\b/gi, 'bengaluru')
    .replace(/\bbombay\b/gi, 'mumbai')
    .replace(/\bcalcutta\b/gi, 'kolkata')
    .replace(/\bmadras\b/gi, 'chennai');
}

function isUnderManagerTerritory(managerUser, target) {
  if (!managerUser) return false;
  if (managerUser.role === 'System Admin') return true;
  if (managerUser.role === 'Sales Representative') return false;

  const mgrTerritory = normalizeCity(managerUser.territory || '');
  const mgrRegion = normalizeCity(managerUser.region || '');
  const repTerritory = normalizeCity(target.territory || '');
  const repRegion = normalizeCity(target.region || '');
  const repCity = normalizeCity(target.city || '');

  // National HQ / All India override
  if (
    mgrTerritory.includes('national') ||
    mgrTerritory.includes('all india') ||
    mgrRegion.includes('all india')
  ) {
    return true;
  }

  // Find if manager belongs to a known metropolitan city
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

  // Fallback direct match for non-metro custom territories
  if (mgrTerritory && (repTerritory.includes(mgrTerritory) || mgrTerritory.includes(repTerritory))) {
    return true;
  }

  if (mgrRegion && repRegion && (repRegion.includes(mgrRegion) || mgrRegion.includes(repRegion))) {
    return true;
  }

  return false;
}

// Test cases
const bengaluruManager = {
  role: 'Sales Manager',
  territory: 'Bengaluru',
  region: 'South Zone (Bengaluru)'
};

const bengaluruSouthManager = {
  role: 'Sales Manager',
  territory: 'Bengaluru South',
  region: 'South Zone (Bengaluru)'
};

const mumbaiManager = {
  role: 'Sales Manager',
  territory: 'Mumbai',
  region: 'West Zone (Mumbai)'
};

const sysAdmin = {
  role: 'System Admin',
  territory: 'National HQ',
  region: 'All India Zones'
};

const salesRep = {
  role: 'Sales Representative',
  territory: 'Bengaluru South',
  region: 'South Zone (Bengaluru)'
};

const reps = [
  { id: 'rep-1', name: 'Vikram Sharma', territory: 'Bengaluru South (Jayanagar - JP Nagar)', region: 'South Zone (Bengaluru)' },
  { id: 'rep-2', name: 'Ananya Verma', territory: 'Bengaluru Central (BTM - Koramangala)', region: 'South Zone (Bengaluru)' },
  { id: 'rep-3', name: 'Rahul Deshmukh', territory: 'Bengaluru East (Indiranagar - Koramangala)', region: 'South Zone (Bengaluru)' },
  { id: 'rep-6', name: 'Sneha Roy', territory: 'Bengaluru South (Banashankari)', region: 'South Zone (Bengaluru)' },
  { id: 'rep-10', name: 'Nagarjun B.G.', territory: 'Bengaluru South (Jayanagar)', region: 'South Zone (Bengaluru)' },
  { id: 'rep-7', name: 'Rohit Mehta', territory: 'Mumbai South (Colaba - Marine Lines)', region: 'West Zone (Mumbai)' },
  { id: 'rep-8', name: 'Amitabh Ghosh', territory: 'Kolkata Central (Park Street)', region: 'East Zone (Kolkata)' },
  { id: 'rep-9', name: 'Suresh Raina', territory: 'Delhi NCR (Connaught Place)', region: 'North Zone (Delhi)' },
];

let passes = 0;
let fails = 0;

function assert(condition, desc) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passes++;
  } else {
    console.error(`[FAIL] ${desc}`);
    fails++;
  }
}

console.log('================================================================');
console.log('RUNNING TERRITORY GOVERNANCE ISOLATION TESTS');
console.log('================================================================\n');

// 1. Bengaluru Manager
const blrTracked = reps.filter(r => isUnderManagerTerritory(bengaluruManager, r));
assert(blrTracked.some(r => r.id === 'rep-1'), 'Bengaluru Manager tracks rep-1 (Vikram Sharma - Bengaluru South)');
assert(blrTracked.some(r => r.id === 'rep-2'), 'Bengaluru Manager tracks rep-2 (Ananya Verma - Bengaluru Central)');
assert(blrTracked.some(r => r.id === 'rep-3'), 'Bengaluru Manager tracks rep-3 (Rahul Deshmukh - Bengaluru East)');
assert(blrTracked.some(r => r.id === 'rep-6'), 'Bengaluru Manager tracks rep-6 (Sneha Roy - Bengaluru South)');
assert(blrTracked.some(r => r.id === 'rep-10'), 'Bengaluru Manager tracks rep-10 (Nagarjun B.G. - Bengaluru South)');
assert(!blrTracked.some(r => r.id === 'rep-7'), 'Bengaluru Manager CANNOT track rep-7 (Rohit Mehta - Mumbai)');
assert(!blrTracked.some(r => r.id === 'rep-8'), 'Bengaluru Manager CANNOT track rep-8 (Amitabh Ghosh - Kolkata)');
assert(!blrTracked.some(r => r.id === 'rep-9'), 'Bengaluru Manager CANNOT track rep-9 (Suresh Raina - Delhi)');

// 2. Mumbai Manager
const mumTracked = reps.filter(r => isUnderManagerTerritory(mumbaiManager, r));
assert(mumTracked.some(r => r.id === 'rep-7'), 'Mumbai Manager tracks rep-7 (Rohit Mehta - Mumbai)');
assert(!mumTracked.some(r => r.id === 'rep-1'), 'Mumbai Manager CANNOT track rep-1 (Bengaluru)');
assert(!mumTracked.some(r => r.id === 'rep-8'), 'Mumbai Manager CANNOT track rep-8 (Kolkata)');
assert(!mumTracked.some(r => r.id === 'rep-9'), 'Mumbai Manager CANNOT track rep-9 (Delhi)');

// 3. System Admin
const adminTracked = reps.filter(r => isUnderManagerTerritory(sysAdmin, r));
assert(adminTracked.length === reps.length, 'System Admin can track all 8 reps nationwide');

// 4. Sales Representative
const repTracked = reps.filter(r => isUnderManagerTerritory(salesRep, r));
assert(repTracked.length === 0, 'Sales Representative cannot track any peer reps (0 reps)');

console.log(`\n================================================================`);
console.log(`TEST SUMMARY: ${passes} PASSED, ${fails} FAILED`);
console.log(`================================================================`);

if (fails > 0) process.exit(1);
