import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';

import { getColorInfo, ColorInfo } from '../utils/colorNames';
import { extractPixelFromPng } from '../utils/pngPixel';
import { rgbToHex } from '../utils/colorMath';
import { COLORS, FONTS } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SCAN_INTERVAL_MS = 1500;
const CROSSHAIR_SIZE = 140;

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [complexMode, setComplexMode] = useState(false);
  const [colorInfo, setColorInfo] = useState<ColorInfo>({
    name: 'Detecting…',
    hex: '#808080',
    emoji: '🔍',
  });
  const [isScanning, setIsScanning] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const scanningRef = useRef(false);

  // Breathing animation for the center circle
  const breathScale = useRef(new Animated.Value(1)).current;
  const scanOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, {
          toValue: 1.12,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(breathScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    breathAnim.start();
    return () => breathAnim.stop();
  }, [breathScale]);

  // Scanning pulse animation
  useEffect(() => {
    if (isScanning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scanOpacity, {
            toValue: 0.4,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scanOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      scanOpacity.setValue(1);
    }
  }, [isScanning, scanOpacity]);

  const scanColor = useCallback(async () => {
    if (scanningRef.current || !cameraRef.current) return;
    scanningRef.current = true;
    setIsScanning(true);

    try {
      // Take a photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
        skipProcessing: true,
      });

      if (!photo) {
        scanningRef.current = false;
        setIsScanning(false);
        return;
      }

      // Crop to center 15% and resize to 1x1
      const imgW = photo.width;
      const imgH = photo.height;
      const cropW = Math.floor(imgW * 0.15);
      const cropH = Math.floor(imgH * 0.15);
      const originX = Math.floor((imgW - cropW) / 2);
      const originY = Math.floor((imgH - cropH) / 2);

      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          {
            crop: {
              originX,
              originY,
              width: cropW,
              height: cropH,
            },
          },
          { resize: { width: 1, height: 1 } },
        ],
        { format: ImageManipulator.SaveFormat.PNG, base64: true }
      );

      if (manipResult.base64) {
        const [r, g, b] = extractPixelFromPng(manipResult.base64);
        const info = getColorInfo(r, g, b, complexMode);
        setColorInfo(info);
      }
    } catch {
      // Silently continue on error
    } finally {
      scanningRef.current = false;
      setIsScanning(false);
    }
  }, [complexMode]);

  useEffect(() => {
    const interval = setInterval(scanColor, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [scanColor]);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>📷 Camera Access Needed</Text>
        <Text style={styles.permText}>
          We need the camera to detect colours around you!
        </Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen camera */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Mode toggle pill — top right */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.togglePill, !complexMode && styles.toggleActive]}
            onPress={() => setComplexMode(false)}
          >
            <Text style={[FONTS.toggle, styles.toggleText, !complexMode && styles.toggleTextActive]}>
              Simple
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, complexMode && styles.toggleActive]}
            onPress={() => setComplexMode(true)}
          >
            <Text style={[FONTS.toggle, styles.toggleText, complexMode && styles.toggleTextActive]}>
              Complex
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Center crosshair with breathing animation */}
      <View style={styles.crosshairContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.crosshairOuter,
            {
              transform: [{ scale: breathScale }],
              opacity: scanOpacity,
            },
          ]}
        >
          {/* Circle */}
          <View style={styles.circle} />
          {/* Crosshair lines */}
          <View style={styles.crossHorizontal} />
          <View style={styles.crossVertical} />
        </Animated.View>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {/* Color swatch strip */}
        <View style={[styles.swatchStrip, { backgroundColor: colorInfo.hex }]} />

        {/* Color info row */}
        <View style={styles.colorInfoRow}>
          <View style={styles.colorTextBlock}>
            <Text style={[FONTS.colorName, styles.colorNameText]}>
              {colorInfo.emoji} {colorInfo.name}
            </Text>
            {complexMode && (
              <Text style={[FONTS.colorNameSub, styles.hexText]}>
                {colorInfo.hex}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  permText: {
    color: COLORS.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  permButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'flex-end',
    paddingTop: 12,
    paddingRight: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    padding: 4,
  },
  togglePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleActive: {
    backgroundColor: COLORS.accent,
  },
  toggleText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: COLORS.text,
  },

  // Crosshair
  crosshairContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairOuter: {
    width: CROSSHAIR_SIZE,
    height: CROSSHAIR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: CROSSHAIR_SIZE,
    height: CROSSHAIR_SIZE,
    borderRadius: CROSSHAIR_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'transparent',
  },
  crossHorizontal: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
  },
  crossVertical: {
    position: 'absolute',
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
  },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 14, 26, 0.88)',
    paddingBottom: 40,
  },
  swatchStrip: {
    height: 8,
    width: '100%',
  },
  colorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  colorTextBlock: {
    flex: 1,
  },
  colorNameText: {
    color: COLORS.text,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
  },
  hexText: {
    color: COLORS.textMuted,
    fontSize: 22,
    fontWeight: '600',
    marginTop: 2,
  },
});
