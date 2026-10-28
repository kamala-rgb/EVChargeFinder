import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function AppTabs() {
  return(
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 55,
          backgroundColor: '#F4F8F5',
          borderTopColor: '#D7E8DA',
          borderTopWidth: 1,
          elevation: 8,
        },
        tabBarActiveTintColor: '#15803D',
        tabBarInactiveTintColor: '#718075',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (<TextIcon symbol="⌂" color={color} size={size} />
          ),
        }}
      />

      ```
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <TextIcon symbol="⌕" color={color} size={size} />
          ),
        }}
      />
    </Tabs>

);
}

function TextIcon({
symbol,
color,
size,
}: {
symbol: string;
color: string;
size: number;
}) {
return (
<Text style={{ color, fontSize: size, fontWeight: '700' }}>
{symbol} </Text>
);
}
