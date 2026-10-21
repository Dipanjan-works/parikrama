// Smart Travel Planner (Itinerary Generator) & Route Optimizer

// Haversine Distance in Kilometers
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert "HH:MM" to minutes from midnight
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

// Convert minutes from midnight to "HH:MM AM/PM"
export function minutesToTimeString(totalMinutes) {
  const m = Math.floor(totalMinutes % 1440);
  let hours = Math.floor(m / 60);
  const minutes = m % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const minStr = minutes < 10 ? `0${minutes}` : minutes;
  return `${hours}:${minStr} ${ampm}`;
}

// Greedy Nearest-Neighbor Route Sequencer
export function optimizeRoute(pandals) {
  if (pandals.length <= 1) return [...pandals];

  const unvisited = [...pandals];
  const ordered = [];

  // Start with the topmost or southernmost depending on zone, default first
  let current = unvisited.shift();
  ordered.push(current);

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const candidate = unvisited[i];
      const dist = calculateDistanceKm(
        current.coordinates.lat, current.coordinates.lng,
        candidate.coordinates.lat, candidate.coordinates.lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    current = unvisited.splice(nearestIndex, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

// Generate complete time-stamped itinerary
export function generateItinerary({
  allPandals,
  day = "Maha Saptami",
  zone = "All",
  startTimeStr = "16:00",
  endTimeStr = "23:30",
  pace = "standard", // "relaxed" | "standard" | "express"
  transportMode = "walk_metro" // "walk_metro" | "cab"
}) {
  // 1. Filter by zone
  let filtered = allPandals;
  if (zone !== "All") {
    const targetZone = zone.toLowerCase();
    filtered = allPandals.filter(p => {
      if (!p.zone) return false;
      const pz = p.zone.toLowerCase();
      return pz === targetZone || pz.includes(targetZone) || targetZone.includes(pz);
    });
    // If not enough in one zone, include nearby
    if (filtered.length === 0) {
      filtered = allPandals;
    }
  }

  // 2. Pace durations (in minutes)
  const paceConfig = {
    relaxed: { stayMin: 70, crowdBufferMin: 20 },
    standard: { stayMin: 45, crowdBufferMin: 15 },
    express: { stayMin: 25, crowdBufferMin: 10 }
  }[pace] || { stayMin: 45, crowdBufferMin: 15 };

  const startMinutes = timeToMinutes(startTimeStr);
  const endMinutes = timeToMinutes(endTimeStr);
  const totalAvailableMinutes = endMinutes > startMinutes 
    ? (endMinutes - startMinutes) 
    : (1440 - startMinutes + endMinutes); // handles overnight parikrama

  // 3. Optimize sequence
  const sequenced = optimizeRoute(filtered);

  // 4. Build schedule
  let currentClock = startMinutes;
  const stops = [];
  let foodBreakInserted = false;
  let totalDistanceCoveredKm = 0;

  for (let i = 0; i < sequenced.length; i++) {
    const pandal = sequenced[i];
    const visitDuration = paceConfig.stayMin + paceConfig.crowdBufferMin;

    // Check if we exceed end time
    if (currentClock + visitDuration > startMinutes + totalAvailableMinutes) {
      break;
    }

    const arriveTimeStr = minutesToTimeString(currentClock);
    const departClock = currentClock + visitDuration;
    const departTimeStr = minutesToTimeString(departClock);

    // Check for dinner/food break around 20:00 (8:00 PM)
    let foodStop = null;
    let foodDuration = 0;
    const currentHour24 = (currentClock / 60) % 24;
    if (!foodBreakInserted && currentHour24 >= 19.5 && currentHour24 <= 21.5) {
      foodBreakInserted = true;
      foodDuration = 35; // 35 min street food break
      const topFood = (pandal.foodRadar && pandal.foodRadar[0]) ? pandal.foodRadar[0] : {
        name: "Authentic Kolkata Street Food Hub",
        specialty: "Kathi Roll, Moglai Paratha & Cha",
        distance: "150m"
      };
      foodStop = {
        name: topFood.name,
        specialty: topFood.specialty,
        rating: topFood.rating || "4.8/5",
        timeRange: `${minutesToTimeString(departClock)} - ${minutesToTimeString(departClock + foodDuration)}`,
        durationMin: foodDuration
      };
    }

    let transitToNext = null;
    let transitTimeMin = 0;

    if (i < sequenced.length - 1) {
      const nextPandal = sequenced[i + 1];
      const distKm = calculateDistanceKm(
        pandal.coordinates.lat, pandal.coordinates.lng,
        nextPandal.coordinates.lat, nextPandal.coordinates.lng
      );
      totalDistanceCoveredKm += distKm;

      // Transit calculation: walking vs metro/cab
      if (distKm <= 1.2) {
        // Walk
        transitTimeMin = Math.max(6, Math.round(distKm * 13)); // ~4.6 km/h
        transitToNext = {
          mode: "walk",
          distanceKm: distKm.toFixed(2),
          durationMin: transitTimeMin,
          label: `🚶 Walk ${Math.round(distKm * 1000)}m (~${transitTimeMin} mins)`
        };
      } else if (distKm <= 3.5) {
        // Metro or Auto
        transitTimeMin = Math.max(12, Math.round(distKm * 5 + 8));
        transitToNext = {
          mode: "metro_auto",
          distanceKm: distKm.toFixed(2),
          durationMin: transitTimeMin,
          label: `🚇 Metro / Auto (~${distKm.toFixed(1)} km, ${transitTimeMin} mins)`
        };
      } else {
        // Cab or Metro
        transitTimeMin = Math.max(18, Math.round(distKm * 4 + 10));
        transitToNext = {
          mode: "cab",
          distanceKm: distKm.toFixed(2),
          durationMin: transitTimeMin,
          label: `🚕 Cab / Metro Ride (~${distKm.toFixed(1)} km, ${transitTimeMin} mins)`
        };
      }
    }

    stops.push({
      stopNumber: stops.length + 1,
      pandal,
      arriveTime: arriveTimeStr,
      departTime: departTimeStr,
      durationMin: visitDuration,
      foodStop,
      transitToNext
    });

    // Advance clock
    currentClock = departClock + foodDuration + transitTimeMin;
  }

  return {
    day,
    zone,
    pace,
    transportMode,
    startTime: minutesToTimeString(startMinutes),
    endTime: minutesToTimeString(currentClock),
    totalPandals: stops.length,
    totalDistanceKm: totalDistanceCoveredKm.toFixed(1),
    stops
  };
}
