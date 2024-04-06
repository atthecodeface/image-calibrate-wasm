#c Imports
import math
import sys
import matplotlib.pyplot as plt
import numpy as np
# from mpl_toolkits.mplot3d import axes3d

import png
import numpy as np

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

window = 200
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

@np.vectorize
def power(c):
    return c.real ** 2 + c.imag ** 2

@np.vectorize
def sc_log_power(c):
    return (8+np.log(c.real ** 2 + c.imag ** 2))*4000

@np.vectorize
def scale(f, min_f, scale):
    return (f - min_f) * scale

delta_f = np.zeros([16], np.float32)
delta_f[0] = 1
delta_f[1] = 1
delta_f[2] = 1
delta_f[3] = 1
delta_f[8] = 1
delta_f[9] = 1
delta_f[10] = 1
delta_f[11] = 1
delta_fft_c = np.fft.fft(delta_f)
print(delta_fft_c)

def pattern_match(img_f, data_c):
    x_sub = 0
    for i in range(1,subsamp):
        x_sub += data_c[i*nsamp//subsamp]
        pass
    x_sub /= (subsamp-1)
    def sub(x):
        return x - x_sub
    data_c_x = sub(data_c)
    data_p = power(data_c_x)
    x = 1
    for i in range(1, subsamp):
        x *= data_p[i*nsamp//subsamp]
        pass
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
