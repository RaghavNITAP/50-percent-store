from math import radians, sin, cos, sqrt, atan2


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in km between two coordinates."""
    R = 6371.0

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c


def zones_overlap(
    buyer_lat: float, buyer_lon: float, buyer_radius: float,
    seller_lat: float, seller_lon: float, seller_radius: float,
) -> bool:
    """True if buyer and seller zones overlap."""
    distance = haversine_distance(buyer_lat, buyer_lon, seller_lat, seller_lon)
    return distance <= (buyer_radius + seller_radius)


def haversine_sql_expression(lat: float, lon: float) -> str:
    """
    Returns a raw SQL expression for haversine distance from a fixed point.
    Used in PostgreSQL queries to filter by radius.
    Units: km
    """
    return f"""
        (6371.0 * acos(
            LEAST(1.0, cos(radians({lat}))
            * cos(radians(pickup_latitude))
            * cos(radians(pickup_longitude) - radians({lon}))
            + sin(radians({lat}))
            * sin(radians(pickup_latitude)))
        ))
    """