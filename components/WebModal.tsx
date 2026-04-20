import { Colors } from '@/constants/Colors';
import React from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import type { ModalProps } from 'react-native';

import { WEB_SIDEBAR_WIDTH } from '@/components/AppSidebar';
export { WEB_SIDEBAR_WIDTH };

/**
 * Su web, renderizza un overlay che parte DOPO la sidebar (left: 240px)
 * così la sidebar rimane sempre visibile sotto il modale.
 * Su native, si comporta esattamente come <Modal />.
 */
export default function WebModal({
  visible,
  onRequestClose,
  children,
  animationType = 'slide',
  presentationStyle,
  ...rest
}: ModalProps) {
  if (Platform.OS !== 'web') {
    return (
      <Modal
        visible={visible}
        animationType={animationType}
        presentationStyle={presentationStyle}
        onRequestClose={onRequestClose}
        {...rest}
      >
        {children}
      </Modal>
    );
  }

  if (!visible) return null;

  return (
    <View
      style={{
        // position: fixed è CSS valido ma non nel type RN — cast necessario
        position: 'fixed' as any,
        top: 0,
        left: WEB_SIDEBAR_WIDTH,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      {/* Backdrop semitrasparente — tap chiude il modale */}
      <Pressable
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          zIndex: 0,
        }}
        onPress={onRequestClose}
      />

      {/* Sheet che sale dal basso — posizionata in absolute per battere il backdrop nel z-index */}
      <View
        style={{
          position: 'absolute' as any,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Colors.dark.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '90%' as any,
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {children}
      </View>
    </View>
  );
}
