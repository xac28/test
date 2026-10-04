import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import { API_BASE, colors } from '../../constants';
import { AvatarPicker } from '../../components/AvatarPicker';
import { TeacherVideos } from '../../components/TeacherVideos';

// The API stores interests as a JSON string but expects an array on update
function parseInterests(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string' || !raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, token, signOut } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setPhone(data.phone || '');
        setCountry(data.country || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        // Only the fields the API allows — sending the whole profile (id, email, role…) is rejected with 403
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          country,
          dateOfBirth: profileData?.dateOfBirth ?? null,
          address: profileData?.address ?? null,
          passportId: profileData?.passportId ?? null,
          interests: parseInterests(profileData?.interests),
        })
      });

      if (res.ok) {
        Alert.alert('Başarılı', 'Profil güncellendi!');
      } else {
        const data = await res.json();
        Alert.alert('Error', data.error || 'Failed to update profile');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpdate = (url: string) => {
    setProfileData((prev: any) => ({ ...prev, image: url }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.ink }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={signOut} style={{ padding: 8, backgroundColor: colors.sage[100], borderRadius: 8 }}>
          <Text style={{ color: colors.sage[700], fontWeight: '600', fontSize: 12 }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AvatarPicker 
          currentImageUrl={user?.image || profileData?.image} 
          onUploadSuccess={handleAvatarUpdate} 
        />

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Your first name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Your last name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 890"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Your country"
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
          </TouchableOpacity>
        </View>

        {user?.role === 'TEACHER' && <TeacherVideos />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.sage[100],
    backgroundColor: colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  form: {
    marginTop: 10,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.sage[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.sage[200],
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
  },
  saveBtn: {
    backgroundColor: colors.sage[600],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
