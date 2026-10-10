[out:json][timeout:45];
(
  way["highway"](23.35,85.31,23.38,85.34);
  nwr["highway"="street_lamp"](23.35,85.31,23.38,85.34);
  nwr["amenity"~"^(police|hospital|pharmacy)$"](23.35,85.31,23.38,85.34);
  nwr["healthcare"~"^(hospital|pharmacy)$"](23.35,85.31,23.38,85.34);
  nwr["shop"]["opening_hours"](23.35,85.31,23.38,85.34);
  nwr["office"]["opening_hours"](23.35,85.31,23.38,85.34);
  nwr["craft"]["opening_hours"](23.35,85.31,23.38,85.34);
  nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bank|fuel|ice_cream|food_court|car_rental|car_wash)$"]["opening_hours"](23.35,85.31,23.38,85.34);
);
out meta geom;
