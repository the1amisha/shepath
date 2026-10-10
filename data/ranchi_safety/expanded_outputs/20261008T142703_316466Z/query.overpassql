[out:json][timeout:45];
(
  way["highway"](23.335059,85.308481,23.38,85.34);
  nwr["highway"~"^(street_lamp|crossing|traffic_signals|elevator|steps|footway|path|pedestrian)$"](23.335059,85.308481,23.38,85.34);
  nwr["crossing"](23.335059,85.308481,23.38,85.34);
  nwr["kerb"](23.335059,85.308481,23.38,85.34);
  nwr["barrier"](23.335059,85.308481,23.38,85.34);
  nwr["sidewalk"](23.335059,85.308481,23.38,85.34);
  nwr["amenity"="police"](23.335059,85.308481,23.38,85.34);
  nwr["healthcare"](23.335059,85.308481,23.38,85.34);
  nwr["amenity"~"^(clinic|dentist|doctors|health_post|hospital|nursing_home|pharmacy)$"](23.335059,85.308481,23.38,85.34);
  nwr["shop"](23.335059,85.308481,23.38,85.34);
  nwr["office"](23.335059,85.308481,23.38,85.34);
  nwr["craft"](23.335059,85.308481,23.38,85.34);
  nwr["amenity"~"^(bank|bar|cafe|car_rental|car_wash|fast_food|food_court|fuel|ice_cream|marketplace|pharmacy|pub|restaurant)$"](23.335059,85.308481,23.38,85.34);
  nwr["tourism"~"^(guest_house|hostel|hotel|motel)$"](23.335059,85.308481,23.38,85.34);
);
out meta geom;
