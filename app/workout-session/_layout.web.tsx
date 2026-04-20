import AppSidebar from '@/components/AppSidebar';
import ChatBot from '@/components/ChatBot';
import { Colors } from '@/constants/Colors';
import { Slot } from 'expo-router';
import { View } from 'react-native';

export default function WorkoutSessionWebLayout() {
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: Colors.dark.background }}>
      <AppSidebar />
      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: Colors.dark.background }}>
        <View style={{ flex: 1, maxWidth: 860, width: '100%', alignSelf: 'center' }}>
          <Slot />
        </View>
      </View>
      <ChatBot />
    </View>
  );
}
