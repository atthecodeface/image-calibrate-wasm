#c Imports
import math
import sys
import matplotlib.pyplot as plt
import numpy as np
# from mpl_toolkits.mplot3d import axes3d

#f diff_sign
def diff_sign(a,b):
    if a<0: return b>0
    return b<0

#c Vec
class Vec:
    def __init__(self, xyz):
        self.xyz = xyz
        pass

    def add(self, other):
        return Vec(((self.xyz[0]+other.xyz[0]),
                   (self.xyz[1]+other.xyz[1]),
                   (self.xyz[2]+other.xyz[2]),
                   ))
    def sub(self, other):
        return Vec(((self.xyz[0]-other.xyz[0]),
                   (self.xyz[1]-other.xyz[1]),
                   (self.xyz[2]-other.xyz[2]),
                   ))
    def scale(self, scale):
        return Vec(((self.xyz[0]*scale),
                   (self.xyz[1]*scale),
                   (self.xyz[2]*scale),
                   ))
    def dot(self, other):
        return self.xyz[0]*other.xyz[0] + self.xyz[1]*other.xyz[1] + self.xyz[2]*other.xyz[2]
    def len(self):
        return math.sqrt(self.dot(self))
    def cross_product(self, other):
        x = self.xyz[1] * other.xyz[2] - self.xyz[2] * other.xyz[1]
        y = self.xyz[2] * other.xyz[0] - self.xyz[0] * other.xyz[2]
        z = self.xyz[0] * other.xyz[1] - self.xyz[1] * other.xyz[0]
        return Vec((x,y,z))
    def angle_between(self, other):
        l0 = self.len()
        l1 = self.len()
        sin_theta = self.cross_product(other).len() / l0 / l1
        return math.degrees(math.asin(sin_theta))
    def __repr__(self):
        return f"Vec:({self.xyz[0]:.3f},{self.xyz[1]:.3f},{self.xyz[2]:.3f})"
    pass

#c Sphere
class Sphere:
    #f __init__
    def __init__(self, center, radius):
        self.center = center
        self.radius = radius
        pass
    #f expanded
    def expanded(self, scale):
        return Sphere(self.center, self.radius*scale)
    #f intersection
    def intersection(self, other):
        """
        Sphere is (p-c).(p-c) = r^2

        Intersect to spheres have a plane with normal (c1-c0), and such
        that p.n = k;

        p.(c1-c0) = p.c1 - p.c0

        But (p-c0).(p-c0) = p.p + c0.c0 - 2*p.c0 = r0^2
            (p-c1).(p-c1) = p.p + c1.c1 - 2*p.c1 = r1^2

        2*p.c1 - 2*p.c0 + c0.c0 - c1.c1 = r0^2 - r1^2
        2*(p.c1 - p.c0) =  r0^2 - r1^2 - c0.c0 + c1.c1
                      k = (r0^2 - r1^2 - c0.c0 + c1.c1) / 2

        
        """
        # Ensure self.radius <= other.radius
        #
        # i.e. other is larger
        if self.radius > other.radius:
            return other.intersection(self)
        c01 = self.center.sub(other.center)
        sep = c01.len()
        if sep > self.radius + other.radius:
            return None
        if sep + self.radius < other.radius:
            return None
        #if sep <= self.radius:
        #    print("arhgj")
        #    die
        #    pass
        r0 = self.radius
        r1 = other.radius
        k = (r0**2 - r1**2 - self.center.dot(self.center) + other.center.dot(other.center)) / 2
        plane = Plane(c01, -k)
        circle = Circle.of_sphere_and_plane(self, plane)

        # cos_theta = (sep**2 - r0**2 - r1**2) / (2 * r0 * r1)
        # sin2_theta = 1 - cos_theta**2
        # radius2 = r0**2 * r1**2 / sep**2 * sin2_theta
        # radius = math.sqrt(radius2)
        # print("Should be equal", circle.radius, radius)
        
        return circle
    #f sphere_intersection
    def sphere_intersection(self, other):
        """
        Sphere is (p-c).(p-c) = r^2

        Create a 'conjunction' sphere that includes all points that are in both spheres

        It should have a radius no bigger than the smaller of the two
        """
        if self.radius > other.radius:
            return other.sphere_intersection(self)
        if self.radius == other.radius:
            return self
        
        c01 = self.center.sub(other.center)
        sep = c01.len()
        if sep > other.radius:
            # Centre is outside other sphere
            if sep - other.radius > self.radius:
                return Sphere(self.center, 0)
            circle = self.intersection(other)
            return Sphere(circle.center, circle.radius)
        # Center is inside other sphere - this is smaller than the other
        if sep+self.radius < other.radius:
            # Completely inside
            return self
        return self
        circle = self.intersection(other)
        print(sep, self.radius, other.radius, "Got circle", circle)
        return Sphere(circle.center, circle.radius)
    #f __repr__
    def __repr__(self):
        return f"Sph:({self.center}:R{self.radius:.3f}"
    pass

#c Line
class Line:
    #f __init__
    def __init__(self, p0, p1):
        self.p0 = p0
        self.p1 = p1
        p01 = p1.sub(p0)
        self.direction = p01.scale(1/p01.len())
        self.k = p0.cross_product(self.direction)
        perp0 = self.k
        vs = [(1,0,0), (0,1,0), (0,0,1)]
        while perp0.len() < 1E-4:
            perp0 = Vec(vs.pop()).cross_product(self.direction)
            pass
        self.perp0 = perp0.scale(1/perp0.len())
        self.perp1 = self.direction.cross_product(self.perp0)
        pass
    #f of_vector_eq
    @classmethod
    def of_vector_eq(cls, direction, k):
        l = direction.len()
        direction = direction.scale(1/l)
        k = k / l
        p0 = direction.cross_product(k)
        p1 = p0.add(direction)
        return cls(p0, p1)
    #f line_pt_closest_to
    def line_pt_closest_to(self, p):
        p = p.sub(self.p0)
        l = p.dot_product(self.direction)
        return self.p0.add(self.direction.scale(l))
    #f cos_angle_subtended
    def cos_angle_subtended(self, p):
        """Get cos(angle) for the angle subtended by the line when viewed from p
        """
        p_p0 = p.sub(self.p0)
        p_p1 = p.sub(self.p1)
        cos_theta = p_p0.dot(p_p1) / (p_p0.len() * p_p1.len())
        return cos_theta
    #f dxyz
    def dxyz(self, p):
        """Generate a dxyz in the direction of most increasing cos(angle
        subtended) for a point p in model space
        """
        delta = 0.01
        cas = self.cos_angle_subtended(p)
        dx = Vec( (delta,0,0) )
        dy = Vec( (0,delta,0) )
        dz = Vec( (0,0,delta) )
        dcdx = self.cos_angle_subtended(p.add(dx)) - cas
        dcdy = self.cos_angle_subtended(p.add(dy)) - cas
        dcdz = self.cos_angle_subtended(p.add(dz)) - cas
        dcdp = Vec((dcdx, dcdy, dcdz))
        l = dcdp.len()
        return dcdp.scale(1/l)
    #f better_pt
    def better_pt(self, cos_theta, p, max_d=0.1, divs=20):
        """Look at the direction required to get the current cos angle subtended
        closer to that desired.

        Go by at most max_d distance.

        Bisect the range of (p, p-by-max_distance), and choose the
        left or right subrange depending on which gives the closest
        match to the desired cos_theta

        This works best when the current point is in 3D space in the
        cylinder around the line; the closer to the line, the closer
        the point needs to be within the cylinder.

        Consider the point relative to the centre of the line; it then
        can be described as k.line_vec + l.perp_vec (unit vectors). We
        basically require k to be between 0 and 0.5, ideally; or l
        large compared to abs(k).

        This constraint can be considered as:

        k = (p - midpoint) . line / |line|

        l = |p - midpoint - k.line|

        """
        cas_p = self.cos_angle_subtended(p)
        dcdp = self.dxyz(p)
        if cas_p > cos_theta:
            dcdp = dcdp.scale(-1)
            pass
        dcdp = dcdp.scale(max_d)
        pts = (p, p.add(dcdp))
        cas = (cas_p, self.cos_angle_subtended(pts[1]))
        for i in range(divs):
            mp = pts[0].add(pts[1])
            mp = mp.scale(0.5)
            mcas = self.cos_angle_subtended(mp)
            use_left = True
            if diff_sign(cas[0]-cos_theta, mcas-cos_theta):
                pass
            elif diff_sign(mcas-cos_theta, cas[1]-cos_theta):
                use_left = False
                pass
            elif abs(cas[0]-cos_theta) > abs(mcas-cos_theta):
                use_left = False
                pass
            if use_left:
                pts = (pts[0], mp)
                cas = (cas[0], mcas)
                pass
            else:
                pts = (mp, pts[1])
                cas = (mcas, cas[1])
                pass
            pass
        new_p = pts[0]
        new_cas = cas[0]
        if abs(new_cas - cos_theta) < abs(cas_p - cos_theta):
            return (True, new_p)
        return (False, p)
    #f __repr__
    def __repr__(self):
        return f"({self.p0}<>{self.p1})"
    pass
        
#c Plane
class Plane:
    """
    All the points in space where p.normal = k
    """
    #f __init__
    def __init__(self, normal, k):
        l = normal.len()
        if k < 0: l = -l
        self.normal = normal.scale(1/l)
        self.k = k / l
        self.pt_on_plane = self.projected_onto(Vec((0,0,0)))
        pass
    #f of_three_pts
    @classmethod
    def of_three_pts(cls, p0, p1, p2):
        p01 = p1.sub(p0)
        p02 = p2.sub(p0)
        normal = p01.cross_product(p02)
        k = p.dot(normal)
        return cls(normal, k)
    #f distance_from
    def distance_from(self, p):
        """
        Note: unit normals...

        p = p_plane + distance * normal
        p.normal = k + distance

        distance = p.normal - k
        """
        return p.dot(self.normal) - self.k
    #f intersect
    def intersect(self, other):
        direction = self.normal.cross_product(other.normal)
        k1_n0 = self.normal.scale(other.k)
        k0_n1 = other.normal.scale(self.k)
        k = k1_n0.sub(k0_n1)
        return Line.of_vector_eq(direction, k)

    #f projected_onto
    def projected_onto(self, p):
        """
        p is a point which may not be on the plane

        in fact p =  p_plane + t * normal

        p.normal = p_plane.normal + t*normal.normal
                 = k + t
        Hence t = p.normal - k
        """
        t = p.dot(self.normal) - self.k
        t_n = self.normal.scale(t)
        return p.sub(t_n)
    #f __repr__
    def __repr__(self):
        return f"Pln:({self.pt_on_plane}^n:{self.normal}:k{self.k:.3f}"
    pass

#c Circle
class Circle:
    #f __init__
    def __init__(self, plane, center, radius):
        self.plane = plane
        self.center = center
        self.radius = radius
        pass
    #f of_sphere_and_plane
    @classmethod
    def of_sphere_and_plane(cls, sphere, plane):
        center = plane.projected_onto(sphere.center)
        d = center.sub(sphere.center).len()
        radius = math.sqrt(sphere.radius**2 - d**2)
        return cls(plane, center, radius)
    #f intersect_plane
    def intersect_plane(self, plane):
        line = self.plane.intersect(plane)
        midpt = line.line_pt_closest_to(self.center)
        d = midpt.sub(self.center).len()
        r = self.radius - d ** 2
        if r<0:
            return (midpt, None, None, None)
        k = math.sqrt(r)
        (midpt, midpt.sub(line.direction.scale(k)), midpt.add(line.direction.scale(k)), line)
        pass
    #f __repr__
    def __repr__(self):
        return f"Cir:{self.center}+R{self.radius:.3f}+n^:{self.plane.normal}"
    pass

#c CamModelLine
class CamModelLine:
    """A view of a line from a camera

    This is the model points in space and the angle subtended at the camera
    """
    #f __init__
    def __init__(self, p0, p1, angle):
        self.p0 = p0
        self.p1 = p1
        self.model_line = Line(p0, p1)
        self.angle = angle
        self.cos_theta = math.cos(math.radians(angle))
        self.sin_theta = math.sin(math.radians(angle))
        self.m = p0.add(p1).scale(0.5)
        self.p01 = p1.sub(p0)
        self.len_p01 = self.p01.len()
        self.radius = self.len_p01 / 2 / self.sin_theta
        pass
    #f of_nac_pms
    @classmethod
    def of_nac_pms(cls, nac_p0, nac_p1, pms_p0, pms_p1):
        angle = pms_p0.angle_between(pms_p1)
        return cls(nac_p0, nac_p1,  angle)
    #f radius_of_circumcircle
    def radius_of_circumcircle(self, p):
        """Given a model space point p, find the radius of the circle that
        includes both the model points of the line and the point p

        The circle will be in the plane of the three points

        The center of the circumcircle will be at the intersection of
        the three spheres of *this* radius centred on the three points

        """
        p0p = p.sub(self.p0)
        p1p = p.sub(self.p1)
        p0p_x_p1p = p0p.cross_product(p1p)
        return self.len_p01 * p0p.len() * p1p.len() / 2 / p0p_x_p1p.len()
    #f circumcircle
    def circumcircle(self, p):
        """Given a model space point p, find the circumcirle that
        includes both the model points of the line and the point p

        TODO!
        """
        return None
    #f enclosings_sphere
    def enclosing_sphere(self):
        """The sphere whose centre is the midpoint of the line and whose
        radius is the maximum distance from the midpoint of the line in model
        space that can subtend the angle

        The furthest points from the midpoint that subtends the angle
        are precisely the points on the circumcircles that are
        directly opposite the line; they are certainly less distance
        than the diameter of the circumcircle.

        They are in fact a distance of the radius PLUS radius*cos_theta
        """
        radius = self.radius + self.radius*self.cos_theta
        center = self.m
        return Sphere(center, radius)
    #f error2_in_p
    def error2_in_p(self, p):
        return (self.radius_of_circumcircle(p) - self.radius)**2
    #f parametric_pt
    def parametric_pt(self, phi, t):
        """ return the point that is on torus circle phi (0 to 2PI) at t in 0 to 1
        """
        r_cos_phi = math.cos(phi) * self.radius
        r_sin_phi = math.sin(phi) * self.radius
        dx = self.model_line.perp0.scale(r_cos_phi)
        dy = self.model_line.perp1.scale(r_sin_phi)
        dxy = dx.add(dy)
        torus_centre = self.m.add(dxy.scale(self.cos_theta))
        theta = self.angle*1.2 + t * (360 - 2.4*self.angle)
        theta = math.radians(theta)
        cos_theta = math.cos(theta)
        sin_theta = math.sin(theta) * self.radius
        pt = torus_centre.add(dxy.scale(-cos_theta)).add(self.model_line.direction.scale(sin_theta))
        return pt                                                   
    #f build_surface
    def build_surface(self, n_phi, n_t):
        pts = []
        for i in range(0, n_phi):
            phi = math.pi*2*i/n_phi
            for t in range(0, n_t):
                p_t = t/(n_t-1)
                pts.append(self.parametric_pt(phi, p_t))
                pass
            pass
        return pts
    #f dxyz
    def dxyz(self, e_fn, p):
        """Generate a dxyz in the direction of most increasing e_fn
        for a point p in model space
        """
        delta = 0.01
        e_p = e_fn(p)
        dx = Vec( (delta,0,0) )
        dy = Vec( (0,delta,0) )
        dz = Vec( (0,0,delta) )
        dcdx = e_fn(p.add(dx)) - e_p
        dcdy = e_fn(p.add(dy)) - e_p
        dcdz = e_fn(p.add(dz)) - e_p
        dcdp = Vec((dcdx, dcdy, dcdz))
        l = dcdp.len()
        return dcdp.scale(1/l)
    #f better_pt
    def better_pt(self, e_fn, p, max_d=0.1, divs=20):
        """Look at the direction required to get the error function reduce

        Go by at most max_d distance.

        Bisect the range of (p, p-by-max_distance), and choose the
        left or right subrange depending on which gives the closest
        match to the desired e_fn

        """
        e_p = e_fn(p)
        dcdp = self.dxyz(e_fn, p)
        dcdp = dcdp.scale(-1)
        dcdp = dcdp.scale(max_d)
        pts = (p, p.add(dcdp))
        errs = (e_p, e_fn(pts[1]))
        for i in range(divs):
            mp = pts[0].add(pts[1])
            mp = mp.scale(0.5)
            merr = e_fn(mp)
            use_left = True
            if merr < errs[0]:
                if merr < errs[1]:
                    use_left = False
                    pass
                pass
            if use_left:
                pts = (pts[0], mp)
                errs = (errs[0], merr)
                pass
            else:
                pts = (mp, pts[1])
                errs = (merr, errs[1])
                pass
            pass
        new_p = pts[0]
        new_err = errs[0]
        if new_err < e_p:
            return (True, new_p)
        return (False, p)
    #f Al done
    pass

#c plot_implicit
def plot_implicit(fn, cxyz=(0,0,0), sz=2.5, c=0, nc=30, res=100):
    ''' create a plot of an implicit function
    fn  ...implicit function (plot where fn==0)
    bbox ..the x,y,and z limits of plotted interval'''
    xmin = cxyz[0] - sz
    xmax = cxyz[0] + sz
    ymin = cxyz[1] - sz
    ymax = cxyz[1] + sz
    zmin = cxyz[2] - sz
    zmax = cxyz[2] + sz
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    A = np.linspace(xmin, xmax, 100) # resolution of the contour
    B = np.linspace(xmin, xmax, 30) # number of slices
    A1,A2 = np.meshgrid(A,A) # grid on which the contour is plotted

    X,Y = np.meshgrid(np.linspace(xmin, xmax, res),np.linspace(ymin, ymax, res))
    for z in np.linspace(zmin, zmax, nc): # plot contours in the XY plane
        Z = fn(X,Y,z) - c
        cset = ax.contour(X, Y, Z+z, [z], zdir='z')
        # [z] defines the only level to plot for this contour for this value of z
        pass

    X,Z = np.meshgrid(np.linspace(xmin, xmax, res),np.linspace(zmin, zmax, res))
    for y in np.linspace(ymin, ymax, nc): # plot contours in the XZ plane
        Y = fn(X,y,Z) - c
        cset = ax.contour(X, Y+y, Z, [y], zdir='y')
        pass

    Y,Z = np.meshgrid(np.linspace(ymin, ymax, res),np.linspace(zmin, zmax, res))
    for x in np.linspace(xmin, xmax, nc): # plot contours in the YZ plane
        X = fn(x,Y,Z) - c
        cset = ax.contour(X+x, Y, Z, [x], zdir='x')
        pass

    # must set plot limits because the contour will likely extend
    # way beyond the displayed level.  Otherwise matplotlib extends the plot limits
    # to encompass all values in the contour.
    ax.set_zlim3d(zmin,zmax)
    ax.set_xlim3d(xmin,xmax)
    ax.set_ylim3d(ymin,ymax)

    plt.show()
    pass

#t Lines etc
p_l = Vec((-1,0,0))
p_r = Vec((1,0,0))
l = Line(p_l, p_r)
for p in [ (0,0.01,0),
           (0,0.1,0),
           (0,0.2,0),
           (0,0.5,0),
           (0,1,0),
           (0,2,0),
           (0,1,0),
           (0.1,1,0),
           (0.2,1,0),
           (0.5,1,0),
           (1,1,0),
           (2,1,0),
           (5,1,0),
           ]:
    print(p, l.cos_angle_subtended(Vec(p)), l.dxyz(Vec(p)).xyz, l.better_pt(0.1, Vec(p)))
    pass
p = Vec( (5,1,0) )
ct = 0.3
while True:
    max_d = p.len()/4.
    m_p = l.better_pt(ct, p, max_d, 200)
    print(m_p, l.cos_angle_subtended(p))
    if not m_p[0]:
        break
    p = m_p[1]
    pass

nac = {"2cm ruler":[0.0,30.0,0.0],
       "7cm ruler":[1.0,-20.0,0.0],
       "1 tl game":[2.0,0.2,90.5],
       "M middle":[69.0,16.2,93.5],
       "5 tl text":[0,105.0,92.0],
       }
pms_40 = {"M middle": ([4111.0,1182.0], [ -0.6914794281857799, -0.6966619453239863, 0.1910977088645111 ]),
       "1 tl game": ([ 3161.0, 1559.0], [ -0.619753966608013, -0.7514802223364663, 0.22623548861920154 ]),
       "2cm ruler": ([ 2660.0, 3548.0], [ -0.543409609267517, -0.7357016762208374, 0.404288313164719 ]),
       "7cm ruler": ([ 3486.0, 3920.0], [ -0.5942175556929381, -0.675246297942925, 0.43697589592640507 ]),
       }

pms_41 = {"M middle": ([ 4952,1336], [ -0.7437379678894437, -0.6367121741221967, 0.2035962731590787 ]),
          "1 tl game": ([ 3144.0, 1928.0], [ -0.6128952812818674, -0.7460207810342678, 0.26040808061087733 ]),
          "2cm ruler": ([ 2877, 3496.0], [ -0.5608892784989683, -0.7246772383093726, 0.40030752870912545 ]),
          "7cm ruler": ([ 3248, 4420], [ -0.5632355498673126, -0.6736738200054219, 0.47846556783635774 ]),
          "5 tl text": ([ 2397,496], [ -0.5747297248399016, -0.8084559884139942, 0.12682530576743023  ]),
       }

pms_42 = {"M middle": ([ 3600,879], [ -0.6595676086166138, -0.7336831088605741, 0.16333911177805477 ]),
          "1 tl game": ([ 3739,1900], [ -0.656004700703411, -0.7093741964983493, 0.2577713754421723 ]),
          "2cm ruler": ([ 3687,4035], [ -0.6051957650497954, -0.659056605427932, 0.4465226498259677 ]),
          "7cm ruler": ([ 5005,3874], [ -0.6960758775682057, -0.5758119919468104, 0.4288576950433538 ]),
          "5 tl text": ([ 905,2425], [ -0.4293342341691295, -0.8528344344550153, 0.29722978110916365 ]),
       }

pms = pms_41
for k in nac:
    nac[k] = Vec(nac[k])
    pass
for p in pms:
    pms[p] = (pms[p][0], Vec(pms[p][1]))
    pass

x_axis = ("1 tl game", "M middle")
y_axis = ("2cm ruler", "7cm ruler")
z_axis = ("2cm ruler", "1 tl game")

cl_x = CamModelLine.of_nac_pms(nac[x_axis[0]], nac[x_axis[1]], pms[x_axis[0]][1], pms[x_axis[1]][1])
cl_y = CamModelLine.of_nac_pms(nac[y_axis[0]], nac[y_axis[1]], pms[y_axis[0]][1], pms[y_axis[1]][1])
cl_z = CamModelLine.of_nac_pms(nac[z_axis[0]], nac[z_axis[1]], pms[z_axis[0]][1], pms[z_axis[1]][1])

cls = []
for p in pms:
    for p2 in pms:
        if p == p2:
            continue
        cls.append(CamModelLine.of_nac_pms(nac[p], nac[p2], pms[p][1], pms[p2][1]))
        pass
    pass

def total_error(p):
    err = 0
    for cl in cls:
        err += cl.error2_in_p(p)
        pass
    return err

pts = cl_x.build_surface(30, 500)
min_err = 1E40
best_pt = None
for p in pts:
    if p.xyz[2]<0: continue
    err = total_error(p)
    if err < min_err:
        print(err, p)
        min_err = err
        best_pt = p
        pass
    pass
print("Best point on surface found", min_err, best_pt)
better_pt = best_pt
while True:
    m_pt = cl_x.better_pt(e_fn=total_error, p=better_pt, max_d=2.0)
    if not m_pt[0]:
        break
    better_pt = m_pt[1]
    print("Better point ", better_pt)
    pass

print("Calculate enclosing spheres")
enc = cls[0].enclosing_sphere()
for cl in cls:
    print(enc, cl.enclosing_sphere())
    enc = enc.sphere_intersection(cl.enclosing_sphere())
    pass
print("Enclosing sphere is ", enc)
@np.vectorize
def f_xy(x, y):
    p = Vec((x,y,0))
    x = cl_x.error2_in_p(p)
    if x < 1: x = 1
    x = math.log(x)
    if x > 10: x = 10
    return x
    return l.cos_angle_subtended( p )
    return math.acos(l.cos_angle_subtended( Vec((x,y,0)) ))

@np.vectorize
def f_xyz(x, y, z):
    p = Vec((x,y,z))
    x = 0
    for cl in cls:
        x += cl.error2_in_p(p)
    if x < 1: x = 1
    x = math.log10(x)
    if x > 10: x = 10
    # if x > 1000: x = 1000
    return x

sphere1 = Sphere(Vec((0,0,0)), 10)
sphere2 = Sphere(Vec((11,0,0)), 2)
c = sphere1.intersection(sphere2)
print(sphere1, sphere2, c)
#a Investigation: find best point for 4v3a6040
# This has three islands
# plot_implicit(f_xyz, cxyz=(0, 0, 0), sz=400, c=4.0, nc=20, res=30)
# This has one island centred on (-240+-20, -290+-30, 190+-40)
# plot_implicit(f_xyz, cxyz=(0, 0, 0), sz=400, c=3.0, nc=40, res=50)
# (-247+-5, -293+-8, 182.5+-8)
# plot_implicit(f_xyz, cxyz=(-240, -290, 190), sz=40, c=2.0, nc=30, res=30)
# (-247+-1, -292+-1, 180+-2)
# plot_implicit(f_xyz, cxyz=(-247, -293, 182.5), sz=8, c=1.0, nc=30, res=30)
# (-247.1+-0.5, -292.4+-0.75, 180.0+-0.9)
# plot_implicit(f_xyz, cxyz=(-247, -292, 180), sz=2, c=0.95, nc=30, res=30)
# As tight as we can get - this is minimum c, pretty much
# plot_implicit(f_xyz, cxyz=(-247.12, -292.4, 180.4), sz=1.0, c=0.93, nc=20, res=30)

if True:
    sys.exit()
    pass

nxy=600
nxy = 130
plt.style.use('_mpl-gallery-nogrid')
X, Y = np.meshgrid(np.linspace(-30, 300, nxy), np.linspace(-300, 300, nxy))


Z = f_xy(X, Y)
levels = np.linspace(np.min(Z), np.max(Z), 20)
fig, ax = plt.subplots()

# ax.contour(X, Y, Z, levels=levels)
ax.imshow(Z)

plt.show()
