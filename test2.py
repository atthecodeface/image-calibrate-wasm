#c Imports
import math
import sys
import matplotlib.pyplot as plt
import numpy as np
# from mpl_toolkits.mplot3d import axes3d

import png
import numpy as np

@np.vectorize
def power(c):
    return c.real ** 2 + c.imag ** 2

@np.vectorize
def sc_log_power(c):
    return (8+np.log(c.real ** 2 + c.imag ** 2))*4000

@np.vectorize
def scale(f, min_f, scale):
    return (f - min_f) * scale

def angle(c):
    return math.atan2(c.imag, c.real)/6.283*8.0

def str_cmp(c):
    p = np.sqrt(power(c))
    a = angle(c)
    s = f"C[{p:.2f} {a:.1f}]"
    return s

e_1_8 = np.power(np.complex128(-1), 0.125)
print(str_cmp(e_1_8))

ofs = 1
delta_f = np.zeros([32], np.float32)
delta_f[0+ofs] = 128/256.0
delta_f[16+ofs] = 75/256.0
delta_f[17+ofs] = 54/256.0
delta_fft_c = np.fft.fft(delta_f)
p_o = 0
p_e = 0
for i in range(32):
    if i==0: continue
    if i %2 == 0: 
        p_e = p_e + math.sqrt(power(delta_fft_c[i]))
        pass
    else:
        p_o = p_o + math.sqrt(power(delta_fft_c[i]))
        pass
    pass
print("Power of odd frequencies of delta_f is", p_o);
print("Power of even frequencies of delta_f is", p_e);

# 0 => phases 0  0  0  0  0  0  0  0
# 1 => phases 0 -1 -2 -3  4  3  2  1
# 2 => phases 0 -2  4  2  0 -2  4  2
# 3 => phases 0 -3  2 -1  4  1 -2  3
# 4 => phases 0  4  0  4  0  4  0  4
#
# i.e. fft[n, ofs] = (n is even) * e_1_8 ^ (-2n * ofs) * power
ofs = 1
delta_f = np.zeros([16], np.float32)
delta_f[9+ofs] = 1
delta_f[0+ofs] = 1
delta_f[1+ofs] = 1
delta_fft_c = np.fft.fft(delta_f)
print([str_cmp(c) for c in delta_fft_c])
print([str_cmp(delta_fft_c[i]*np.power(e_1_8, i)) for i in range(9)])

# Multiply DFT by DFT of 1.0.0...0.1.00.0...
x = 0
y = 0
z = 0
for i in range(16):
    f = delta_fft_c[i]
    # f2 = delta_fft_c[(i+2)%16]
    if i > 0 and i % 2 == 0 and i<=8:
        x += power(f)
        pass
    elif i%2 == 1:
        x -= power(f)
        # z -= f.real ** 2
        pass
    if i > 0 and i%2 == 0 and i<8:
        y += f    
        z += f * np.power(e_1_8, i)
        pass
    pass
print("ofs", ofs, "x", str_cmp(x), "y", str_cmp(y), "z", str_cmp(z))

# ofs = (2 - z.angle)/2
#
# power = sqrt(x/8)
#
# we can subtract (n is even) * e_1_8 ^ (-2n * ofs) * power
z_as_ofs = (2 - angle(z))/2

y = delta_fft_c[8]**2
#for i in range(8):
s = 1
for i in [1,2,3,4,5,6,7]:
    s = - s
    y += delta_fft_c[i] * delta_fft_c[16-i] * s
    pass

x = x / 4
x = np.sqrt(max(x,0))
d = delta_fft_c[2]
print("x", str_cmp(x), "d", str_cmp(delta_fft_c[8]), "y", str_cmp(y))
d_p = math.sqrt(power(d))
d_a = delta_fft_c[2] / d_p
d = [delta_fft_c[2*i] - x*np.power(e_1_8, -2*i*z_as_ofs) for i in range(8)]
print([str_cmp(c) for c in d])
argh

filename = "cip0_orig.png"
# filename = "cip0_sd.png"
reader = png.Reader(filename)
data = reader.asDirect()
pixels = data[2]
image = []

for row in pixels:
    #row = np.asarray(row)
    #row = np.reshape(row, [-1, 3])
    image.append(row)
    pass

image = np.stack(image, 1)

print(image.dtype)
print(image.shape)
print(image[387][707] / 65536.0)
print(type(image))

# This works okay for sd image
cx = 387
cy = 707
nsamp = 32
radius = 16
subsamp = 4

# Playing with just the image itself (not sd)
# Way tiny amount
nsamp = 64
radius = 16
subsamp = 16

# More points
nsamp = 64
radius = 16
subsamp = 8

# Good halos, no lines
nsamp = 16
radius = 16
subsamp = 8

# Good halos, no lines
nsamp = 16
radius = 8
subsamp = 8

# Loses everything
nsamp = 16 # also with 32
radius = 8
subsamp = 16

# Shadowy, no lines
nsamp = 32
radius = 8
subsamp = 8

# Halos, lines
nsamp = 8
radius = 16
subsamp = 8

# Halos, lines
nsamp = 8
radius = 16
subsamp = 4

# Halos, lines, noisy
nsamp = 64
radius = 16
subsamp = 4

# Some Halos, small amount of lines
nsamp = 32
radius = 16
subsamp = 8

# This one does seem to be the best
nsamp = 16 # Increasing makes us lose more. Why? - probably E-16 is not small enough
radius = 8 # increasing makes halos
subsamp = 8 # decreasing increases line presence and detects more

# nsamp = 128 # Increasing makes us lose more. Why?
# radius = 8 # increasing makes halos
# subsamp = 8 # decreasing increases line presence and detects more

window = 100
stride = 2

if False:
    data_f = np.zeros([2*window+1,2*window+1], np.float32)
    for wx in range(2*window+1):
        for wy in range(2*window+1):
            data_f[wx][wy] = image[cx+(wx-window)*stride][cy+(wy-window)*stride]
            pass
        pass
    data_u = np.array(data_f, np.uint16)
    out_image = np.stack(data_u, 1)
    oimg = png.from_array(out_image, 'L;16' )
    oimg.save(f"out_sd_window.png")
    sys.exit()
    pass

def circle(cx, cy, r, nsamp):
    data_f = np.zeros([nsamp], np.float32)
    for i in range(nsamp):
        angle = 2*3.14159265 * i/nsamp
        dx = math.sin(angle)
        dy = math.cos(angle)
        data_f[i] = image[int(cx+dx*r)][int(cy+dy*r)] / 65536.0
        pass
    return data_f

def pattern_match(img_f, data_c):
    x_sub = np.complex128(0)
    #for i in range(1,subsamp//2):
    #    x_sub += data_c[i*nsamp//subsamp].real
    #    pass
    # This is much better than including the imaginary parts
    # It kills y=-x diagonals; maybe not y=x?
    if True:
        x_sub += data_c[2].real * 2
        x_sub += data_c[4].real * 2
        x_sub += data_c[6].real * 2
        pass
    else:
        x_sub += data_c[2] * 2
        x_sub += data_c[4] * 2
        x_sub += data_c[6] * 2
        pass
    x_sub += data_c[8]
    x_sub /= (subsamp-1)
    def sub(x):
        return x - x_sub
    data_c_x = sub(data_c)
    data_p = power(data_c_x)
    x = 1
    # Good
    for i in range(1, subsamp):
        x *= data_p[i*nsamp//subsamp]
        pass
    x = data_p[2] * data_p[4] * data_p[6] * data_p[8] * data_p[10] * data_p[12] * data_p[14]
    x = data_p[2] * data_p[4] * data_p[6] * data_p[8] # * data_p[10] * data_p[12] * data_p[14]
    return (16+np.log10(max(x,1E-16)))**3
    return img_f * (16+np.log10(max(x,1E-16)))**3

if True:
    data_f = np.zeros([2*window+1,2*window+1], np.float32)
    for wx in range(2*window+1):
        x = cx+(wx-window)*stride
        for wy in range(2*window+1):
            y = cy+(wy-window)*stride
            data_c = np.fft.fft(circle(x,y, radius, nsamp))
            data_f[wx][wy] = pattern_match(image[x][y], data_c)
            pass
        pass
    print(data_f.min(), data_f.max())
    min_f = data_f.min()
    max_f = data_f.max()
    data_f = scale(data_f, min_f, 65536/(max_f-min_f))
    data_u = np.array(data_f, np.uint16)
    out_image = np.stack(data_u, 1)
    oimg = png.from_array(out_image, 'L;16' )
    oimg.save(f"out_sd_match.png")
    pass

if False:
    for component in range(10):
        data_f = np.zeros([2*window+1,2*window+1], np.float32)
        for wx in range(2*window+1):
            for wy in range(2*window+1):
                data_c = np.fft.fft(circle(cx+(wx-window)*stride, cy+(wy-window)*stride, radius, nsamp))
                data_f[wx][wy] = sc_log_power(data_c)[component]
                pass
            pass
        data_u = np.array(data_f, np.uint16)
        out_image = np.stack(data_u, 1)
        oimg = png.from_array(out_image, 'L;16' )
        oimg.save(f"out_sd_{component}.png")
        pass
    pass
      
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
