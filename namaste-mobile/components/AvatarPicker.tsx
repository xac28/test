import React, { useState } from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE as API_URL } from '../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AvatarPickerProps {
  currentImageUrl?: string | null;
  onUploadSuccess: (url: string) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ currentImageUrl, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(currentImageUrl || null);

  const requestPermissions = async () => {
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (cameraStatus.status !== 'granted' || libraryStatus.status !== 'granted') {
      Alert.alert('Permissions needed', 'Sorry, we need camera and camera roll permissions to make this work!');
      return false;
    }
    return true;
  };

  const handlePickImage = async (useCamera: boolean) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square
      quality: 0.8, // Good quality but compressed
    };

    let result;
    if (useCamera) {
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setPreviewUri(asset.uri);
      uploadImage(asset.uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        setUploading(false);
        return;
      }

      // Convert uri to a Blob or use FormData
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const formData = new FormData();
      formData.append('file', { uri, name: filename, type } as any);
      formData.append('type', 'avatar');

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, // If API expects it, but our Next.js uses cookies for auth. Wait, the Next.js API uses `auth()`. The mobile app might be authenticated differently. We must pass credentials or token.
          // In namaste-mobile, how is auth handled? It might be JWT or something. Let's check.
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const fullUrl = data.url.startsWith('http') ? data.url : `${API_URL}${data.url}`;
        onUploadSuccess(fullUrl);
      } else {
        const errorData = await response.json().catch(() => ({}));
        Alert.alert('Upload Failed', errorData.error || 'Something went wrong');
      }
    } catch (error: any) {
      console.error('Upload Error:', error);
      Alert.alert('Error', 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {previewUri ? (
          <Image source={{ uri: previewUri.startsWith('http') || previewUri.startsWith('file') ? previewUri : `${API_URL}${previewUri}` }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No Photo</Text>
          </View>
        )}
        
        {uploading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.buttonOutline]} 
          onPress={() => handlePickImage(false)}
          disabled={uploading}
        >
          <Text style={styles.buttonOutlineText}>Gallery</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.buttonPrimary]} 
          onPress={() => handlePickImage(true)}
          disabled={uploading}
        >
          <Text style={styles.buttonPrimaryText}>Camera</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    borderWidth: 3,
    borderColor: '#7f9c96',
    position: 'relative',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7f9c96',
  },
  buttonOutlineText: {
    color: '#7f9c96',
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: '#7f9c96',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
